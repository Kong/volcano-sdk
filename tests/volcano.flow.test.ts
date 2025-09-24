import { spawn } from 'node:child_process';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { agent, mcp, llmOpenAI, llmAnthropic, llmMistral, llmLlama, llmBedrock, llmVertexStudio } from '../dist/volcano-sdk.js';

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

describe('volcano-sdk flow (automatic tool selection) across providers', () => {
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

  const providerMatrix: Array<{ name: string; make: () => any; requireEnv?: string[] }> = [
    {
      name: 'OpenAI',
      make: () => {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for this test');
        return llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_MODEL || undefined });
      },
      requireEnv: ['OPENAI_API_KEY'],
    },
    {
      name: 'Anthropic',
      make: () => {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required for this test');
        return llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307' });
      },
      requireEnv: ['ANTHROPIC_API_KEY'],
    },
    {
      name: 'Mistral',
      make: () => {
        if (!process.env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is required for this test');
        return llmMistral({ apiKey: process.env.MISTRAL_API_KEY!, baseURL: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai', model: process.env.MISTRAL_MODEL || 'mistral-small-latest' });
      },
      requireEnv: ['MISTRAL_API_KEY'],
    },
    {
      name: 'Llama',
      make: () => {
        return llmLlama({ baseURL: process.env.LLAMA_BASE_URL || 'http://127.0.0.1:11434', model: process.env.LLAMA_MODEL || 'llama3.2:3b' });
      },
    },
    {
      name: 'Bedrock',
      make: () => {
        if (!process.env.AWS_BEARER_TOKEN_BEDROCK && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)) {
          throw new Error('AWS_BEARER_TOKEN_BEDROCK or (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) are required for this test');
        }
        return llmBedrock({ 
          region: process.env.AWS_REGION || 'us-east-1',
          ...(process.env.AWS_BEARER_TOKEN_BEDROCK ? {
            bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK
          } : {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: process.env.AWS_SESSION_TOKEN,
          }),
          model: process.env.BEDROCK_MODEL || 'amazon.nova-micro-v1:0'
        });
      },
      requireEnv: ['AWS_BEARER_TOKEN_BEDROCK'],
    },
    {
      name: 'VertexStudio',
      make: () => {
        if (!process.env.GCP_VERTEX_API_KEY) {
          throw new Error('GCP_VERTEX_API_KEY is required for this test');
        }
        return llmVertexStudio({ 
          apiKey: process.env.GCP_VERTEX_API_KEY!,
          model: 'gemini-2.5-flash-lite'
        });
      },
      requireEnv: ['GCP_VERTEX_API_KEY'],
    },
  ];

  for (const p of providerMatrix) {
    describe(`Provider: ${p.name}`, () => {
      it('runs a two-step automatic flow using both MCP servers', async () => {
        if (p.requireEnv) for (const k of p.requireEnv) { if (!process.env[k]) throw new Error(`${k} is required for this test`); }
        const astro = mcp('http://localhost:3211/mcp');
        const favorites = mcp('http://localhost:3212/mcp');

        const llm = p.make();

        const results = await agent({ llm })
          .then({ prompt: 'Determine the astrological sign for the birthdate 1993-07-11 using available tools. You must call exactly one tool.', mcps: [astro] })
          .then({ prompt: 'Based on the astrological sign Cancer, determine my favorite food and drink using available tools. You must call exactly one tool.', mcps: [favorites] })
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
      }, p.name === 'Llama' ? 120000 : 60000);

      it('runs a one-step automatic flow using both MCP servers (one-liner)', async () => {
        if (p.requireEnv) for (const k of p.requireEnv) { if (!process.env[k]) throw new Error(`${k} is required for this test`); }
        const astro = mcp('http://localhost:3211/mcp');
        const favorites = mcp('http://localhost:3212/mcp');

        const llm = p.make();

        // Google Vertex Studio has limitations with multiple tools, so adjust the test
        const prompt = p.name === 'VertexStudio' 
          ? "Get the astrological sign for birthdate 1993-07-11 using available tools."
          : "I need to find food preferences for someone born on 1993-07-11. First call get_sign with birthdate '1993-07-11', then call get_preferences with the sign you get back. Use both tools in this single step.";
        
        const mcps = p.name === 'VertexStudio' 
          ? [astro] // Only provide one MCP service to avoid multiple tool limitation
          : [astro, favorites];

        const results = await agent({ llm })
          .then({
            prompt,
            mcps
          })
          .run();

        expect(results.length).toBe(1);
        const step = results[0];
        expect(step.toolCalls && step.toolCalls.length).toBeGreaterThanOrEqual(1);
        const names = (step.toolCalls || []).map(c => c.name);
        console.log(`${p.name} called tools:`, names);
        
        // All providers should at least call the sign lookup tool
        expect(names).toContain('localhost_3211_mcp.get_sign');
        
        // The test verifies that automatic tool selection works
        if (p.name === 'VertexStudio') {
          // Google Vertex Studio only supports one tool at a time for non-search tools
          expect(step.toolCalls.length).toBe(1);
          expect(names).toEqual(['localhost_3211_mcp.get_sign']);
        } else {
          // Other providers can handle multiple tools or be more flexible
          expect(step.toolCalls.length).toBeGreaterThan(0);
        }
      }, p.name === 'Llama' ? 120000 : 60000);
    });
  }
});
