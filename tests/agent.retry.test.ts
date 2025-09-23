import { describe, it, expect, vi } from 'vitest';
import { agent } from '../dist/volcano-sdk.js';

function makeFlakyLlm(failures: number, delayMs = 0) {
  let count = 0;
  return {
    id: 'OpenAI-flaky',
    model: 'fake',
    client: {},
    gen: async () => {
      if (delayMs) await new Promise(r => setTimeout(r, delayMs));
      count++;
      if (count <= failures) throw new Error('flaky');
      return 'OK';
    },
    genWithTools: async () => ({ content: '', toolCalls: [] }),
    genStream: async function* () {}
  } as any;
}

describe('agent retries', () => {
  it('immediate retry by default (delay 0)', async () => {
    const llm = makeFlakyLlm(1);
    const res = await agent({ llm })
      .then({ prompt: 'hello' })
      .run();
    expect(res[0].llmOutput).toBe('OK');
  });

  it('delayed retry waits configured seconds between attempts', async () => {
    vi.useFakeTimers();
    const llm = makeFlakyLlm(1);
    const p = agent({ llm, retry: { delay: 20, retries: 2 } })
      .then({ prompt: 'hello' })
      .run();
    // advance time enough to cover 20s delay
    await vi.advanceTimersByTimeAsync(20_000);
    const res = await p;
    expect(res[0].llmOutput).toBe('OK');
    vi.useRealTimers();
  });

  it('backoff retry increases wait time exponentially (seconds base)', async () => {
    vi.useFakeTimers();
    const llm = makeFlakyLlm(3);
    const p = agent({ llm, retry: { backoff: 2, retries: 4 } })
      .then({ prompt: 'hello' })
      .run();
    // waits: 1s, 2s, 4s (then success)
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);
    const res = await p;
    expect(res[0].llmOutput).toBe('OK');
    vi.useRealTimers();
  });

  it('per-step retry overrides agent retry', async () => {
    vi.useFakeTimers();
    const llm = makeFlakyLlm(1);
    const p = agent({ llm, retry: { delay: 20, retries: 2 } })
      .then({ prompt: 'A', retry: { delay: 0, retries: 2 } })
      .run();
    // step overrides to immediate, so no 20s wait necessary
    const res = await p;
    expect(res[0].llmOutput).toBe('OK');
    vi.useRealTimers();
  });

  it('throws if both delay and backoff are set at agent level', async () => {
    const llm = makeFlakyLlm(0);
    let err: any;
    try {
      await agent({ llm, retry: { delay: 1, backoff: 2 } })
        .then({ prompt: 'x' })
        .run();
    } catch (e) { err = e; }
    expect(String(err?.message || '')).toMatch(/either delay or backoff/);
  });

  it('throws if both delay and backoff are set at step level', async () => {
    const llm = makeFlakyLlm(0);
    let err: any;
    try {
      await agent({ llm })
        .then({ prompt: 'x', retry: { delay: 1, backoff: 2 } })
        .run();
    } catch (e) { err = e; }
    expect(String(err?.message || '')).toMatch(/either delay or backoff/);
  });
});
