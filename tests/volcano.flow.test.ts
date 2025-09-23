import { spawn } from 'node:child_process';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { agent, mcp, llmOpenAI } from '../dist/volcano-sdk.js';

function waitForOutput(proc: any, match: RegExp, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    const onData = (data: Buffer) => {
      if (match.test(data.toString())) {
        cleanup();
        resolve();
      }
    };
    const onErr = (data: Buffer) => {
      if (match.test(data.toString())) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      proc.stdout?.off('data', onData);
      proc.stderr?.off('data', onErr);
      clearTimeout(timer);
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onErr);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for server output'));
    }, timeoutMs);
  });
}

function startServer(cmd: string, args: string[], env: Record<string, string | undefined> = {}) {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  return proc;
}

describe('volcano-sdk flow (automatic tool selection, real OpenAI)', () => {
  let astroProc: any;
  let favProc: any;

  beforeAll(async () => {
    astroProc = startServer('node', ['mcp/astro/server.mjs'], { PORT: '3211' });
    favProc = startServer('node', ['mcp/favorites/server.mjs'], { PORT: '3212' });
    await waitForOutput(astroProc, /astro-mcp\] listening on :3211/);
    await waitForOutput(favProc, /favorites-mcp\] listening on :3212/);
  }, 60000);

  afterAll(async () => {
    astroProc?.kill();
    favProc?.kill();
  });

  it('runs a two-step automatic flow using both MCP servers (OpenAI)', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for this test');
    }
    const astro = mcp('http://localhost:3211/mcp');
    const favorites = mcp('http://localhost:3212/mcp');

    const apiKey = process.env.OPENAI_API_KEY!;
    const model = process.env.OPENAI_MODEL || undefined;

    const llm = llmOpenAI({ apiKey, model });

    const results = await agent({ llm })
      .then({
        prompt: 'Determine the astrological sign for the birthdate 1993-07-11 using available tools.',
        mcps: [astro]
      })
      .then({
        prompt: 'Based on the astrological sign Cancer, determine my favorite food and drink using available tools.',
        mcps: [favorites]
      })
      .run();

    expect(results.length).toBe(2);

    const step1 = results[0];
    expect(step1.toolCalls && step1.toolCalls.length).toBeGreaterThanOrEqual(1);
    const step1Names = (step1.toolCalls || []).map(c => c.name);
    expect(step1Names).toContain('localhost_3211_mcp.get_sign');

    const step2 = results[1];
    expect(step2.toolCalls && step2.toolCalls.length).toBeGreaterThanOrEqual(1);
    const step2Names = (step2.toolCalls || []).map(c => c.name);
    expect(step2Names).toContain('localhost_3212_mcp.get_preferences');
  }, 60000);

  it('runs a one-step automatic flow using both MCP servers (OpenAI one-liner)', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for this test');
    }

    const astro = mcp('http://localhost:3211/mcp');
    const favorites = mcp('http://localhost:3212/mcp');

    const apiKey = process.env.OPENAI_API_KEY!;
    const model = process.env.OPENAI_MODEL || undefined;

    const llm = llmOpenAI({ apiKey, model });

    const results = await agent({ llm })
      .then({
        prompt:
          "For birthdate 1993-07-11, determine the astrological sign and then my favorite food and drink based on that sign. You must use the available tools to perform exactly two tool calls: first determine the sign, then determine the favorites using that sign. Do not fabricate results; do not respond until after both tool calls are completed. Provide a brief summary at the end.",
        mcps: [astro, favorites]
      })
      .run();

    expect(results.length).toBe(1);
    const step = results[0];
    expect(step.toolCalls && step.toolCalls.length).toBeGreaterThanOrEqual(2);
    const names = (step.toolCalls || []).map(c => c.name);
    expect(names).toContain('localhost_3211_mcp.get_sign');
    expect(names).toContain('localhost_3212_mcp.get_preferences');
  }, 60000);
});
