import { z } from 'zod';

export type LlmProviderType = 'gemini' | 'anthropic';

export interface LlmProvider {
  name: string;
  generateJson<T>(
    systemPrompt: string,
    input: any,
    zodSchema: z.ZodSchema<T>
  ): Promise<T>;
}
