import { describe, it, expect } from 'vitest';
import { agent, mcp, __internal_primeDiscoveryCache } from '../dist/volcano-sdk.js';

function makeLLM() {
  return {
    id: 'OpenAI-mock', model: 'mock', client: {},
    gen: async (p: string) => 'OK', genWithTools: async () => ({ content: '', toolCalls: [] }), genStream: async function*(){}
  } as any;
}

describe('tool argument validation', () => {
  it('validates explicit MCP tool args against schema', async () => {
    const llm = makeLLM();
    const svc = mcp('http://localhost:3997/mcp');
    __internal_primeDiscoveryCache(svc, [
      { name: 'do_thing', inputSchema: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'], additionalProperties: false } }
    ]);
    let err: any;
    try {
      await agent({ llm })
        .then({ mcp: svc, tool: 'do_thing', args: { x: 'not-a-number' } as any })
        .run();
    } catch (e) { err = e; }
    expect(String(err?.message || '')).toMatch(/failed schema validation/);
  });

  it('validates automatic tool calls against schema (simulated)', async () => {
    const svc = mcp('http://localhost:3996/mcp');
    __internal_primeDiscoveryCache(svc, [
      { name: 'do_thing', inputSchema: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'], additionalProperties: false } }
    ]);
    const llm = {
      id: 'OpenAI-mock', model: 'mock', client: {
        chat: { completions: { create: async () => ({ choices: [{ message: { content: '', tool_calls: [ { id: '1', function: { name: 'localhost_3996_mcp_do_thing', arguments: JSON.stringify({ x: 'NaN' }) } } ] } }] }) } }
      },
      gen: async () => 'OK', genWithTools: async () => ({ content: '', toolCalls: [] }), genStream: async function*(){}
    } as any;
    let err: any;
    try {
      await agent({ llm })
        .then({ prompt: 'auto', mcps: [svc] })
        .run();
    } catch (e) { err = e; }
    expect(String(err?.message || '')).toMatch(/failed schema validation/);
  });
});
