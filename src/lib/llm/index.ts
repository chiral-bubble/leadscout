import { LlmProvider } from '@/types/llm';
import { GeminiProvider } from './gemini-provider';
import { AnthropicProvider } from './anthropic-provider';

export function getLlmProvider(): LlmProvider {
  const providerType = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  if (providerType === 'anthropic') {
    return new AnthropicProvider();
  }

  // Default to GeminiProvider (free tier)
  return new GeminiProvider();
}
