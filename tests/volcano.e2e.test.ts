import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, llmOpenAI, mcp } from '../dist/volcano-sdk.js';

function waitForOutput(proc: any, match: RegExp, timeoutMs = 8000) {
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

describe('volcano-sdk e2e with mock MCP servers', () => {
  let astroProc: any;
  let favProc: any;

  beforeAll(async () => {
    astroProc = startServer('node', ['mcp/astro/server.mjs'], { PORT: '3201' });
    favProc = startServer('node', ['mcp/favorites/server.mjs'], { PORT: '3202' });
    await waitForOutput(astroProc, /astro-mcp\] listening on :3201/);
    await waitForOutput(favProc, /favorites-mcp\] listening on :3202/);
  }, 20000);

  afterAll(async () => {
    astroProc?.kill();
    favProc?.kill();
  });

  it('chains sign lookup to favorites', async () => {
    // Use explicit tool calls to be deterministic in test
    const astro = mcp('astro', 'http://localhost:3201/mcp');
    const favorites = mcp('favorites', 'http://localhost:3202/mcp');

    // For LLM usage we can stub with a minimal handle to avoid network
    const llm = llmOpenAI('noop', { apiKey: 'sk-test' });
    // But avoid calling OpenAI in the test by not using llm steps

    const birthdate = '1993-07-11'; // Cancer

    const results = await agent()
      .then({ mcp: astro, tool: 'get_sign', args: { birthdate } })
      .then({ mcp: favorites, tool: 'get_preferences', args: { sign: 'Cancer' } })
      .run();

    const first = results[0];
    const second = results[1];

    expect(first.mcp?.tool).toBe('get_sign');
    expect(typeof first.mcp?.result).toBe('object');

    // favorites returns JSON string in text content, but SDK returns raw result
    expect(second.mcp?.tool).toBe('get_preferences');
    expect(typeof second.mcp?.result).toBe('object');
  }, 20000);
});

// Run with: npx vitest run -t "default LLM"

import { describe, it, expect } from "vitest";

describe("agent default LLM", () => {
  it("uses default LLM when step.llm is omitted", async () => {
    const captured: string[] = [];
    const fake: any = {
      id: "fake",
      model: "test",
      client: {},
      gen: async (p: string) => { captured.push(p); return "OK"; },
      genWithTools: async () => ({ content: "", toolCalls: [] }),
      genStream: async function* () {}
    };

    const res = await agent()
      .llm(fake)
      .then({ prompt: "hello" })
      .run();

    expect(captured[0]).toBe("hello");
    expect(res[0].llmOutput).toBe("OK");
  });

  it("overrides default with per-step llm", async () => {
    const callsA: string[] = [];
    const callsB: string[] = [];
    const A: any = { id: "A", model: "A", client: {}, gen: async (p: string) => { callsA.push(p); return "A"; }, genWithTools: async () => ({ content: "", toolCalls: [] }), genStream: async function*(){} };
    const B: any = { id: "B", model: "B", client: {}, gen: async (p: string) => { callsB.push(p); return "B"; }, genWithTools: async () => ({ content: "", toolCalls: [] }), genStream: async function*(){} };

    const res = await agent()
      .llm(A)
      .then({ prompt: "one" })
      .then({ prompt: "two", llm: B })
      .run();

    expect(callsA).toEqual(["one"]);
    expect(callsB).toEqual(["two"]);
    expect(res[0].llmOutput).toBe("A");
    expect(res[1].llmOutput).toBe("B");
  });
});
