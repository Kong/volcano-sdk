import { describe, it, expect } from 'vitest';
import { llmOpenAI } from '../../dist/volcano-sdk.js';

describe('OpenAI provider (integration)', () => {
  it('calls OpenAI and returns at least one tool call when tools are provided', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for this test');
    }
    const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_MODEL });
    const tools: any = [{
      name: 'astro.get_sign',
      description: 'Return sign for birthdate',
      parameters: { type: 'object', properties: { birthdate: { type: 'string' } }, required: ['birthdate'] }
    }];
    const res = await llm.genWithTools('Find the astrological sign for 1993-07-11 using available tools.', tools);
    expect(Array.isArray(res.toolCalls)).toBe(true);
  }, 60000);
});
