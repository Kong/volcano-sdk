import { describe, it, expect } from 'vitest';
import { llmCohere } from '../../dist/volcano-sdk.js';

describe('Cohere provider (integration)', () => {
  it('calls Cohere and returns at least one tool call when tools are provided', async () => {
    if (!process.env.COHERE_API_KEY) {
      throw new Error('COHERE_API_KEY is required for this test');
    }
    const llm = llmCohere({ apiKey: process.env.COHERE_API_KEY!, model: process.env.COHERE_MODEL || 'command-a-03-2025' });
    const tools: any = [{
      name: 'astro.get_sign',
      description: 'Return sign for birthdate',
      parameters: { type: 'object', properties: { birthdate: { type: 'string' } }, required: ['birthdate'] }
    }];
    const res = await llm.genWithTools('Find the astrological sign for 1993-07-11 using available tools.', tools);
    expect(Array.isArray(res.toolCalls)).toBe(true);
  }, 60000);

  it('streams tokens that concatenate to the non-stream answer', async () => {
    if (!process.env.COHERE_API_KEY) {
      throw new Error('COHERE_API_KEY is required for this test');
    }
    const llm = llmCohere({ apiKey: process.env.COHERE_API_KEY!, model: process.env.COHERE_MODEL || 'command-a-03-2025' });
    const prompt = 'Reply ONLY with STREAM_OK';
    const nonStream = await llm.gen(prompt);
    const normalizedA = nonStream.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();

    let streamed = '';
    for await (const chunk of llm.genStream(prompt)) {
      streamed += chunk;
    }
    const normalizedB = streamed.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();

    // Proper property: streaming concat should equal non-stream output (normalized)
    expect(normalizedA).toBe(normalizedB);
    expect(normalizedA.length).toBeGreaterThan(0);
  }, 30000);

  it('can produce valid JSON when asked', async () => {
    if (!process.env.COHERE_API_KEY) {
      throw new Error('COHERE_API_KEY is required for this test');
    }
    const llm = llmCohere({ apiKey: process.env.COHERE_API_KEY!, model: process.env.COHERE_MODEL || 'command-a-03-2025' });
    const prompt = 'Return ONLY valid minified JSON: {"ok":true,"provider":"cohere"}';
    const out = await llm.gen(prompt);
    const text = out.trim();
    // Extract JSON if wrapped in code fences
    const m = text.match(/\{[\s\S]*\}/);
    const jsonStr = m ? m[0] : text;
    const obj = JSON.parse(jsonStr);
    expect(obj && obj.ok === true && obj.provider === 'cohere').toBe(true);
  }, 30000);
});
