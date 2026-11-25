import { z } from 'zod';
import { LlmProvider } from '@/types/llm';

export class GeminiProvider implements LlmProvider {
  name = 'GeminiProvider';
  private apiKey: string;
  private model: string;
  private maxRpm: number;
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.maxRpm = parseInt(process.env.GEMINI_MAX_RPM || '10', 10);
  }

  async generateJson<T>(
    systemPrompt: string,
    input: any,
    zodSchema: z.ZodSchema<T>
  ): Promise<T> {
    const dataMode = process.env.DATA_MODE || 'live';

    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey === 'your-gemini-api-key') {
      if (dataMode === 'live') {
        throw new Error(
          'GeminiProvider error: GEMINI_API_KEY is missing in live mode. Please configure GEMINI_API_KEY in .env.local or switch DATA_MODE=demo.'
        );
      }
    }

    const promptText = `Here is the input data to process:\n\n${JSON.stringify(input, null, 2)}`;

    // Attempt 1
    try {
      const responseText = await this.enqueueRequest(() =>
        this.callGeminiApi(systemPrompt, promptText)
      );

      const rawParsed = JSON.parse(this.cleanJsonString(responseText));
      const parsed = this.normalizeCommonFields(rawParsed);
      const validated = zodSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      console.warn('Gemini response failed Zod schema validation, retrying once...', validated.error.format());
    } catch (err: any) {
      console.warn('Gemini Attempt 1 failed:', err.message);
    }

    // Attempt 2 (Retry with correction instructions)
    const retryPromptText = `${promptText}\n\nCRITICAL: Your previous response was either invalid JSON or did not match the required schema. Output STRICTLY valid JSON matching the schema, with no markdown backticks, no commentary, and no extra fields.`;

    const retryResponseText = await this.enqueueRequest(() =>
      this.callGeminiApi(systemPrompt, retryPromptText)
    );

    const retryRawParsed = JSON.parse(this.cleanJsonString(retryResponseText));
    const retryParsed = this.normalizeCommonFields(retryRawParsed);
    const retryValidated = zodSchema.safeParse(retryParsed);

    if (retryValidated.success) {
      return retryValidated.data;
    }

    throw new Error(
      `GeminiProvider validation error after retry: ${JSON.stringify(retryValidated.error.format())}`
    );
  }

  /**
   * Rate-limited queue: ensures no more than maxRpm requests per minute (default 10 req/min).
   */
  private async enqueueRequest<R>(fn: () => Promise<R>): Promise<R> {
    const minIntervalMs = Math.ceil(60000 / this.maxRpm); // e.g. 6000ms for 10 RPM

    return new Promise<R>((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(async () => {
          const now = Date.now();
          const elapsed = now - this.lastRequestTime;
          if (elapsed < minIntervalMs) {
            await new Promise((res) => setTimeout(res, minIntervalMs - elapsed));
          }
          this.lastRequestTime = Date.now();
          return fn();
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Calls Google Gemini REST API with exponential backoff on 429 rate limits.
   */
  private async callGeminiApi(systemPrompt: string, userPrompt: string, retries = 5): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    let delayMs = 3000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.status === 429 || response.status === 503) {
          console.warn(`Gemini ${response.status} hit. Backing off for ${delayMs}ms (attempt ${attempt}/${retries})...`);
          await new Promise((res) => setTimeout(res, delayMs));
          delayMs = Math.min(delayMs * 2, 25000);
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Gemini API HTTP ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error('Gemini API returned an empty candidate text response');
        }

        return text;
      } catch (err: any) {
        console.warn(`Gemini API request attempt ${attempt}/${retries} error:`, err.message);
        if (attempt === retries) throw err;
        await new Promise((res) => setTimeout(res, delayMs));
        delayMs *= 2;
      }
    }

    throw new Error('Gemini API failed after rate limit retries');
  }

  private cleanJsonString(str: string): string {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) return match[0];
    return str.trim();
  }

  private normalizeCommonFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    let res = { ...obj };

    // Unpack if model wrapped response in top-level key
    if (res.analysis && typeof res.analysis === 'object') {
      res = { ...res.analysis };
    } else if (res.lead_analysis && typeof res.lead_analysis === 'object') {
      res = { ...res.lead_analysis };
    } else if (res.data && typeof res.data === 'object' && (res.data.business_summary || res.data.opportunities)) {
      res = { ...res.data };
    }

    // 1. best_contact_channel
    if (res.best_contact_channel) {
      const ch = String(res.best_contact_channel).toLowerCase().trim();
      if (ch === 'phone' || ch === 'call' || ch === 'telephone') {
        res.best_contact_channel = 'phone_call';
      } else if (ch === 'form' || ch === 'web_form') {
        res.best_contact_channel = 'contact_form';
      }
    }

    // 2. digital_presence normalization
    if (res.digital_presence && typeof res.digital_presence === 'object') {
      const dp = { ...res.digital_presence };
      if (dp.website_quality) {
        const wq = String(dp.website_quality).toLowerCase();
        if (!['none', 'poor', 'average', 'good'].includes(wq)) {
          dp.website_quality = wq.includes('good') ? 'good' : wq.includes('poor') ? 'poor' : 'average';
        }
      }
      if (dp.social_presence) {
        const sp = String(dp.social_presence).toLowerCase();
        if (!['none', 'weak', 'active'].includes(sp)) {
          dp.social_presence = sp.includes('active') ? 'active' : sp.includes('none') ? 'none' : 'weak';
        }
      }
      if (dp.booking_or_ordering_online !== undefined) {
        dp.booking_or_ordering_online = Boolean(dp.booking_or_ordering_online);
      }
      if (!Array.isArray(dp.evidence)) {
        dp.evidence = [];
      }
      res.digital_presence = dp;
    }

    // 3. Fallbacks for arrays
    if (!Array.isArray(res.recommended_secondary_services)) {
      res.recommended_secondary_services = [];
    }
    if (!Array.isArray(res.risks_or_red_flags)) {
      res.risks_or_red_flags = [];
    }
    if (!Array.isArray(res.data_gaps)) {
      res.data_gaps = [];
    }

    // 4. Pitch claims on variants (if present)
    if (Array.isArray(res.variants)) {
      res.variants = res.variants.map((v: any) => {
        if (!v || typeof v !== 'object') return v;
        const vCopy = { ...v };
        if (!Array.isArray(vCopy.claims)) {
          vCopy.claims = [];
        }
        return vCopy;
      });
    }

    return res;
  }
}
