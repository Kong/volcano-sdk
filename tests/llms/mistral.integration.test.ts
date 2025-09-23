import { describe, it, expect } from 'vitest';
import { llmMistral } from '../../dist/volcano-sdk.js';

describe('Mistral provider (integration)', () => {
  it('calls Mistral Cloud with live API when MISTRAL_API_KEY is set', async () => {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is required for this test');
    }
    const base = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai';
    const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
    const llm = llmMistral({ baseURL: base, apiKey: process.env.MISTRAL_API_KEY!, model });
    const prompt = 'Echo exactly this token with no quotes, no punctuation, no extra text: MISTRAL_OK';
    const out = await llm.gen(prompt);
    expect(typeof out).toBe('string');
    const normalized = out.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
    expect(['MISTRAL_OK', 'MISTRALOK']).toContain(normalized);
  }, 30000);

  it('follows constrained echo', async () => {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is required for this test');
    }
    const base = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai';
    const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
    const llm = llmMistral({ baseURL: base, apiKey: process.env.MISTRAL_API_KEY!, model });
    const prompt = 'Reply ONLY with MISTRAL_OK_2';
    const out = await llm.gen(prompt);
    const normalized = out.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
    expect(/^MISTRAL_?OK/.test(normalized)).toBe(true);
  }, 30000);
});


