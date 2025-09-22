import { describe, it, expect, vi, beforeEach } from 'vitest';
import { llmOpenAI } from '../../dist/volcano-sdk.js';

const calls: any[] = [];

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: async (req: any) => {
          calls.push(req);
          return {
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    { id: 't1', function: { name: 'astro_get_sign', arguments: '{"birthdate":"1993-07-11"}' } }
                  ]
                }
              }
            ]
          } as any;
        }
      }
    };
    constructor(_: any) {}
  }
  return { default: MockOpenAI };
});

describe('OpenAI provider (unit)', () => {
  beforeEach(() => { calls.length = 0; });

  it('sanitizes tool names and maps back to dotted names', async () => {
    const llm: any = llmOpenAI('test', { apiKey: 'sk-test' });
    const tools = [
      {
        name: 'astro.get_sign',
        description: 'Get sign',
        parameters: { type: 'object', properties: { birthdate: { type: 'string' } } }
      }
    ];

    const res = await llm.genWithTools('Do task', tools as any);

    expect(calls.length).toBe(1);
    expect(calls[0].tools[0].function.name).toBe('astro_get_sign');
    expect(res.toolCalls[0].name).toBe('astro.get_sign');
  });
});
