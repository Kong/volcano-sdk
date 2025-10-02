import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { agent, mcp } from '../src/volcano-sdk.js';

function waitForOutput(proc: any, match: RegExp, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${match}`)), timeoutMs);
    const handler = (data: Buffer) => {
      if (match.test(data.toString())) {
        clearTimeout(timer);
        proc.stdout?.off('data', handler);
        proc.stderr?.off('data', handler);
        resolve(true);
      }
    };
    proc.stdout?.on('data', handler);
    proc.stderr?.on('data', handler);
  });
}

function startServer(cmd: string, args: string[], env: Record<string, string | undefined> = {}) {
  const proc = spawn(cmd, args, { env: { ...process.env, ...env } });
  return proc;
}

function makeMockLLM() {
  return {
    id: 'mock',
    model: 'mock',
    client: {},
    gen: async () => 'OK',
    genWithTools: async () => ({ content: '', toolCalls: [] }),
    genStream: async function*(){}
  } as any;
}

describe('Mixed HTTP and STDIO MCP Servers', () => {
  let httpProc: any;
  
  beforeAll(async () => {
    // Start HTTP MCP server
    httpProc = startServer('node', ['mcp/astro/server.mjs'], { PORT: '4001' });
    await waitForOutput(httpProc, /listening on :4001/);
  }, 30000);
  
  afterAll(async () => {
    httpProc?.kill();
  });
  
  describe('HTTP + STDIO in same workflow', () => {
    it('calls HTTP server then STDIO server', async () => {
      const httpMcp = mcp('http://localhost:4001/mcp');
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      const results = await agent({ llm: makeMockLLM() })
        .then({ 
          mcp: httpMcp,
          tool: 'get_sign',
          args: { birthdate: '1993-07-11' }
        })
        .then({ 
          mcp: stdioMcp,
          tool: 'get_time',
          args: {}
        })
        .run();
      
      expect(results.length).toBe(2);
      expect(results[0].mcp?.tool).toBe('get_sign');
      expect(results[0].mcp?.endpoint).toContain('http://localhost:4001');
      expect(results[1].mcp?.tool).toBe('get_time');
      expect(results[1].mcp?.endpoint).toContain('stdio://node');
    }, 20000);
    
    it('calls STDIO server then HTTP server', async () => {
      const httpMcp = mcp('http://localhost:4001/mcp');
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      const results = await agent({ llm: makeMockLLM() })
        .then({ 
          mcp: stdioMcp,
          tool: 'reverse_string',
          args: { text: 'volcano' }
        })
        .then({ 
          mcp: httpMcp,
          tool: 'get_sign',
          args: { birthdate: '2000-01-01' }
        })
        .run();
      
      expect(results.length).toBe(2);
      expect(results[0].mcp?.tool).toBe('reverse_string');
      expect(results[0].mcp?.endpoint).toContain('stdio://node');
      expect(results[1].mcp?.tool).toBe('get_sign');
      expect(results[1].mcp?.endpoint).toContain('http://localhost:4001');
    }, 20000);
    
    it('automatic tool selection with both HTTP and STDIO servers', async () => {
      const httpMcp = mcp('http://localhost:4001/mcp');
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      const llm: any = {
        id: 'test',
        model: 'test',
        client: {},
        gen: async () => 'OK',
        genWithTools: async (_prompt: string, tools: any[]) => {
          // Should have tools from both servers
          const httpTools = tools.filter(t => t.name.includes('.get_sign'));
          const stdioTools = tools.filter(t => t.name.includes('.get_time') || t.name.includes('.reverse_string'));
          
          expect(httpTools.length).toBeGreaterThan(0);
          expect(stdioTools.length).toBeGreaterThan(0);
          
          // Call one from each
          return {
            content: '',
            toolCalls: [
              {
                name: httpTools[0].name,
                arguments: { birthdate: '1995-05-15' },
                mcpHandle: httpMcp
              },
              {
                name: stdioTools[0].name,
                arguments: stdioTools[0].name.includes('reverse') ? { text: 'test' } : {},
                mcpHandle: stdioMcp
              }
            ]
          };
        },
        genStream: async function*(){}
      };
      
      const results = await agent({ llm })
        .then({ 
          prompt: 'Use tools from both servers',
          mcps: [httpMcp, stdioMcp]
        })
        .run();
      
      expect(results[0].toolCalls).toBeDefined();
      // May have multiple iterations, just verify at least 2 tools called
      expect(results[0].toolCalls!.length).toBeGreaterThanOrEqual(2);
      
      // Should have called both HTTP and STDIO tools
      const endpoints = results[0].toolCalls!.map(t => t.endpoint);
      const hasHttp = endpoints.some(e => e.includes('http://localhost:4001'));
      const hasStdio = endpoints.some(e => e.includes('stdio://node'));
      
      expect(hasHttp).toBe(true);
      expect(hasStdio).toBe(true);
    }, 20000);
  });
  
  describe('authentication with mixed transports', () => {
    it('HTTP server uses auth, STDIO server does not', async () => {
      const httpMcp = mcp('http://localhost:4002/mcp', {
        auth: {
          type: 'bearer',
          token: 'test-token'
        }
      });
      
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      // HTTP has auth
      expect(httpMcp.auth).toBeDefined();
      expect(httpMcp.auth?.type).toBe('bearer');
      
      // STDIO doesn't have auth (not applicable)
      expect(stdioMcp.auth).toBeUndefined();
      
      // Both can be used together
      const results = await agent({ llm: makeMockLLM() })
        .then({ 
          mcp: stdioMcp,
          tool: 'get_time',
          args: {}
        })
        .run();
      
      expect(results[0].mcp?.result).toBeDefined();
    }, 20000);
    
    it('STDIO ignores auth configuration in agent-level mcpAuth', async () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      // Agent has auth config, but STDIO should ignore it
      const results = await agent({ 
        llm: makeMockLLM(),
        mcpAuth: {
          'stdio://some-endpoint': {  // This won't apply to STDIO
            type: 'bearer',
            token: 'ignored-token'
          }
        }
      })
        .then({ 
          mcp: stdioMcp,
          tool: 'reverse_string',
          args: { text: 'auth test' }
        })
        .run();
      
      // Should work without auth (STDIO doesn't use HTTP auth)
      expect(results[0].mcp?.result).toBeDefined();
    }, 20000);
  });
  
  describe('pooling and lifecycle', () => {
    it('reuses STDIO process across multiple steps', async () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      const results = await agent({ llm: makeMockLLM() })
        .then({ 
          mcp: stdioMcp,
          tool: 'reverse_string',
          args: { text: 'step1' }
        })
        .then({ 
          mcp: stdioMcp,
          tool: 'reverse_string',
          args: { text: 'step2' }
        })
        .then({ 
          mcp: stdioMcp,
          tool: 'get_time',
          args: {}
        })
        .run();
      
      // All three steps should complete
      expect(results.length).toBe(3);
      results.forEach(r => {
        expect(r.mcp?.result).toBeDefined();
      });
      
      // Process should be reused (same pool entry)
    }, 20000);
  });
});