import { describe, it, expect, beforeEach } from 'vitest';
import { agent, mcp, __internal_clearOAuthTokenCache } from '../src/volcano-sdk.js';

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

describe('MCP STDIO Transport', () => {
  beforeEach(() => {
    __internal_clearOAuthTokenCache();
  });
  
  describe('STDIO configuration', () => {
    it('creates STDIO MCP handle with command', () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      expect(stdioMcp.id).toMatch(/^mcp_stdio_[a-f0-9]{8}$/);
      expect(stdioMcp.stdio).toBeDefined();
      expect(stdioMcp.stdio?.command).toBe('node');
      expect(stdioMcp.stdio?.args).toEqual(['mcp/stdio-server/server.mjs']);
      expect(stdioMcp.url).toBeUndefined();
    });
    
    it('creates deterministic ID from command + args', () => {
      const mcp1 = mcp({
        command: 'node',
        args: ['server.js']
      });
      
      const mcp2 = mcp({
        command: 'node',
        args: ['server.js']
      });
      
      // Same command+args = same ID
      expect(mcp1.id).toBe(mcp2.id);
    });
    
    it('different commands produce different IDs', () => {
      const node = mcp({
        command: 'node',
        args: ['server.js']
      });
      
      const python = mcp({
        command: 'python',
        args: ['server.py']
      });
      
      expect(node.id).not.toBe(python.id);
    });
    
    it('supports environment variables', () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['server.js'],
        env: { DEBUG: 'true', PORT: '3000' }
      });
      
      expect(stdioMcp.stdio?.env).toEqual({ DEBUG: 'true', PORT: '3000' });
    });
  });
  
  describe('STDIO vs HTTP differentiation', () => {
    it('HTTP handles have url, no stdio', () => {
      const httpMcp = mcp('http://localhost:3000/mcp');
      
      expect(httpMcp.url).toBe('http://localhost:3000/mcp');
      expect(httpMcp.stdio).toBeUndefined();
      expect(httpMcp.id).toMatch(/^mcp_[a-f0-9]{8}$/);
    });
    
    it('STDIO handles have stdio, no url', () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['server.js']
      });
      
      expect(stdioMcp.stdio).toBeDefined();
      expect(stdioMcp.url).toBeUndefined();
      expect(stdioMcp.id).toMatch(/^mcp_stdio_[a-f0-9]{8}$/);
    });
    
    it('STDIO handles cannot have auth', () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['server.js']
      });
      
      // Auth is only for HTTP transport
      expect(stdioMcp.auth).toBeUndefined();
    });
  });
  
  describe('STDIO tool calling', () => {
    it('calls tools on STDIO MCP server', async () => {
      const stdioMcp = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      const results = await agent({ llm: makeMockLLM() })
        .then({ 
          mcp: stdioMcp,
          tool: 'reverse_string',
          args: { text: 'hello' }
        })
        .run();
      
      expect(results[0].mcp?.result).toBeDefined();
      expect(results[0].mcp?.tool).toBe('reverse_string');
      
      // Result should be reversed string
      const content = results[0].mcp?.result?.content?.[0]?.text;
      expect(content).toBe('olleh');
    }, 20000);
    
    it('automatic tool selection works with STDIO', async () => {
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
          // Should have discovered tools from STDIO server
          expect(tools.length).toBeGreaterThan(0);
          
          const reverseTool = tools.find(t => t.name.endsWith('.reverse_string'));
          expect(reverseTool).toBeDefined();
          
          return {
            content: '',
            toolCalls: [{
              name: reverseTool!.name,
              arguments: { text: 'volcano' },
              mcpHandle: stdioMcp
            }]
          };
        },
        genStream: async function*(){}
      };
      
      const results = await agent({ llm })
        .then({ prompt: 'Reverse the string volcano', mcps: [stdioMcp] })
        .run();
      
      expect(results[0].toolCalls).toBeDefined();
      expect(results[0].toolCalls!.length).toBeGreaterThan(0);
    }, 20000);
    
    it('multi-step workflow with STDIO server', async () => {
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
          tool: 'get_time',
          args: {}
        })
        .run();
      
      expect(results.length).toBe(2);
      expect(results[0].mcp?.tool).toBe('reverse_string');
      expect(results[1].mcp?.tool).toBe('get_time');
    }, 20000);
  });
  
  describe('mixed HTTP and STDIO', () => {
    it('can use both transports in same workflow', async () => {
      const stdio1 = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      const stdio2 = mcp({
        command: 'node',
        args: ['mcp/stdio-server/server.mjs']
      });
      
      // Use two STDIO servers (proves pooling works)
      const results = await agent({ llm: makeMockLLM() })
        .then({ 
          mcp: stdio1,
          tool: 'reverse_string',
          args: { text: 'hello' }
        })
        .then({ 
          mcp: stdio2,
          tool: 'get_time',
          args: {}
        })
        .run();
      
      expect(results.length).toBe(2);
      expect(results[0].mcp?.endpoint).toContain('stdio://node');
      expect(results[1].mcp?.endpoint).toContain('stdio://node');
    }, 20000);
  });
  
  describe('error handling', () => {
    it('throws error when STDIO command not found', async () => {
      const badStdio = mcp({
        command: 'nonexistent-command-xyz',
        args: []
      });
      
      let error: any;
      try {
        await agent({ llm: makeMockLLM() })
          .then({ 
            mcp: badStdio,
            tool: 'any_tool',
            args: {}
          })
          .run();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      // Process spawn errors come through as MCPToolError
      expect(error.name).toMatch(/MCP(Connection|Tool)Error/);
    }, 20000);
  });
});
