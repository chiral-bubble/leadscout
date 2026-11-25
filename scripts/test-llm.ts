import { getLlmProvider } from '../src/lib/llm';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const TestSchema = z.object({
  status: z.string(),
  message: z.string(),
  provider_tested: z.string(),
  model_tested: z.string(),
  timestamp: z.string(),
});

async function main() {
  const dataMode = process.env.DATA_MODE || 'live';
  console.log('='.repeat(70));
  console.log('PROOF OF LIVE LLM TEST (DATA_MODE=' + dataMode + ')');
  console.log('='.repeat(70));

  const provider = getLlmProvider();
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`Provider Name : ${provider.name}`);
  console.log(`Model         : ${modelName}`);

  if (!apiKey || apiKey.trim() === '') {
    console.error('\n[FATAL ERROR] GEMINI_API_KEY is missing in your environment or .env.local file.');
    console.error('In DATA_MODE=live, fallback templates are strictly forbidden.');
    process.exit(1);
  }

  const systemPrompt = `You are a strict JSON test engine. Return a valid JSON object matching the requested schema.`;
  const input = {
    action: 'ping_test',
    request_timestamp: new Date().toISOString(),
    expected_fields: ['status', 'message', 'provider_tested', 'model_tested', 'timestamp'],
  };

  try {
    const rawResult = await provider.generateJson(systemPrompt, input, TestSchema);
    console.log('\n--- RAW JSON RESPONSE FROM LIVE CALL ---');
    console.log(JSON.stringify(rawResult, null, 2));
    console.log('='.repeat(70));
    console.log('LIVE LLM VERIFICATION SUCCESSFUL!');
    console.log('='.repeat(70));
  } catch (err: any) {
    console.error('\n[FATAL ERROR] Live LLM call failed:', err.message);
    if (dataMode === 'live') {
      console.error('Execution failed: Fallback to mock templates is strictly disabled in DATA_MODE=live.');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR]', err.message);
  process.exit(1);
});
