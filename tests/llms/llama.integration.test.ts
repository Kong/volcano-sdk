import { describe, it, expect } from 'vitest';
import { llmLlama } from '../../dist/volcano-sdk.js';

describe('Llama provider (integration)', () => {
  it('calls an OpenAI-compatible endpoint via baseURL/model (Ollama)', async () => {
    const base = process.env.LLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const model = process.env.LLAMA_MODEL || 'llama3.2:3b';
    const llm = llmLlama({ baseURL: base, model });
    const prompt = 'Echo exactly this token with no quotes, no punctuation, no extra text: LLAMA_OK';
    const out = await llm.gen(prompt);
    expect(typeof out).toBe('string');
    const normalized = out.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
    expect(/^LLAMA_?OK/.test(normalized)).toBe(true);
  }, 30000);

  it('follows constrained echo (variant)', async () => {
    const base = process.env.LLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const model = process.env.LLAMA_MODEL || 'llama3.2:3b';
    const llm = llmLlama({ baseURL: base, model });
    const prompt = 'Reply ONLY with LLAMA_OK_2';
    const out = await llm.gen(prompt);
    const normalized = out.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
    expect(/^LLAMA_?OK/.test(normalized)).toBe(true);
  }, 30000);
});


