import { spawn } from 'node:child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { agent, mcp } from '../dist/volcano-sdk.js';

function waitForOutput(proc: any, match: RegExp, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    const onData = (data: Buffer) => { if (match.test(data.toString())) { cleanup(); resolve(); } };
    const onErr = (data: Buffer) => { if (match.test(data.toString())) { cleanup(); resolve(); } };
    const cleanup = () => { proc.stdout?.off('data', onData); proc.stderr?.off('data', onErr); clearTimeout(timer); };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onErr);
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout waiting for server output')); }, timeoutMs);
  });
}

function startServer(cmd: string, args: string[], env: Record<string, string | undefined> = {}) {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  return proc;
}

describe('context configuration', () => {
  let astroProc: any;
  const PORT = '3294';

  beforeAll(async () => {
    astroProc = startServer('node', ['mcp/astro/server.mjs'], { PORT });
    await waitForOutput(astroProc, new RegExp(`astro-mcp\\] listening on :${PORT}`));
  }, 20000);

  afterAll(async () => { astroProc?.kill(); });

  it('per-step contextMaxToolResults limits number of tool results in context', async () => {
    const astro = mcp(`http://localhost:${PORT}/mcp`);
    let capturedPrompt = '';
    const llm: any = {
      id: 'OpenAI-mock', model: 'mock', client: {},
      gen: async (p: string) => { capturedPrompt = p; return 'OK'; },
      genWithTools: async (_prompt: string, tools: any[]) => {
        const dotted = `localhost_${PORT}_mcp.get_sign`;
        const found = tools.find(t => t.name === dotted);
        return {
          content: '',
          toolCalls: [
            { name: found.name, arguments: { birthdate: '1993-07-11' }, mcpHandle: astro },
            { name: found.name, arguments: { birthdate: '1993-07-11' }, mcpHandle: astro },
            { name: found.name, arguments: { birthdate: '1993-07-11' }, mcpHandle: astro },
          ]
        };
      },
      genStream: async function*(){}
    };

    await agent({ llm })
      .then({ prompt: 'auto tools', mcps: [astro] })
      .then({ prompt: 'second step', contextMaxToolResults: 2 })
      .run();

    const start = capturedPrompt.indexOf('[Context from previous steps]');
    expect(start).toBeGreaterThanOrEqual(0);
    const ctx = capturedPrompt.slice(start);
    const lines = (ctx.match(/\n- /g) || []).length;
    expect(lines).toBe(2);
  }, 30000);

  it('agent-level contextMaxChars caps injected context length', async () => {
    const longText = 'X'.repeat(5000);
    let captured: string[] = [];
    const llm: any = {
      id: 'OpenAI-mock', model: 'mock', client: {},
      gen: async (p: string) => { captured.push(p); return longText; }, genWithTools: async () => ({ content: '', toolCalls: [] }), genStream: async function*(){}
    };

    captured = [];
    await agent({ llm, contextMaxChars: 100 })
      .then({ prompt: 'first' })
      .then({ prompt: 'second' })
      .run();

    // Check context block size in second call
    const p = captured[1];
    const idx = p.indexOf('[Context from previous steps]');
    expect(idx).toBeGreaterThanOrEqual(0);
    const context = p.slice(idx);
    expect(context.length).toBeLessThanOrEqual(100);
  });
});
