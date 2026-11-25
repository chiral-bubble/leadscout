import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { LlmProvider } from '@/types/llm';

export class AnthropicProvider implements LlmProvider {
  name = 'AnthropicProvider';
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  }

  async generateJson<T>(
    systemPrompt: string,
    input: any,
    zodSchema: z.ZodSchema<T>
  ): Promise<T> {
    const dataMode = process.env.DATA_MODE || 'live';

    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey === 'your-anthropic-api-key') {
      if (dataMode === 'live') {
        throw new Error(
          'AnthropicProvider error: ANTHROPIC_API_KEY is missing in live mode. Please set ANTHROPIC_API_KEY in .env.local or choose LLM_PROVIDER=gemini.'
        );
      }
    }

    const anthropic = new Anthropic({ apiKey: this.apiKey });
    const userPrompt = `Here is the input data to process:\n\n${JSON.stringify(input, null, 2)}`;

    // Attempt 1
    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = (response.content.find((c) => c.type === 'text') as any)?.text || '';
      const parsed = JSON.parse(this.cleanJsonString(text));
      const validated = zodSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      console.warn('Anthropic response failed Zod schema validation, retrying once...', validated.error.format());
    } catch (err: any) {
      console.warn('Anthropic Attempt 1 failed:', err.message);
    }

    // Attempt 2 (Retry with correction instructions)
    const retryResponse = await anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
        {
          role: 'user',
          content:
            'CRITICAL: Your previous response was either not valid JSON or failed schema validation. Please reply with STRICTLY valid JSON only matching the schema exactly, with NO markdown backticks, NO introduction, and NO trailing text.',
        },
      ],
    });

    const retryText = (retryResponse.content.find((c) => c.type === 'text') as any)?.text || '';
    const retryParsed = JSON.parse(this.cleanJsonString(retryText));
    const retryValidated = zodSchema.safeParse(retryParsed);

    if (retryValidated.success) {
      return retryValidated.data;
    }

    throw new Error(
      `AnthropicProvider validation error after retry: ${JSON.stringify(retryValidated.error.format())}`
    );
  }

  private cleanJsonString(str: string): string {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) return match[0];
    return str.trim();
  }
}
