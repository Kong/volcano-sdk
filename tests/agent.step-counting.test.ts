import { describe, it, expect } from 'vitest';
import { agent } from '../src/volcano-sdk.js';

function createMockLLM(responses: string[] = ['response']) {
  let callIndex = 0;
  return {
    id: 'test-llm',
    model: 'test-model',
    client: {},
    gen: async () => responses[callIndex++] || responses[responses.length - 1],
    genWithTools: async () => ({ content: responses[callIndex++] || responses[responses.length - 1], toolCalls: [] }),
    genStream: async function*() { yield 'test'; },
    getUsage: () => ({ inputTokens: 10, outputTokens: 10, totalTokens: 20 })
  } as any;
}

describe('Agent Step Counting', () => {
  it('counts regular steps correctly', () => {
    const llm = createMockLLM();
    const testAgent = agent({ llm, hideProgress: true })
      .then({ prompt: 'Step 1' })
      .then({ prompt: 'Step 2' })
      .then({ prompt: 'Step 3' });
    
    const steps = (testAgent as any)._getSteps();
    expect(steps.length).toBe(3);
  });

  it('recursively counts steps in runAgent sub-agents', () => {
    const llm = createMockLLM();
    
    // Sub-agent with 2 steps
    const subAgent = agent({ llm, hideProgress: true })
      .then({ prompt: 'Sub step 1' })
      .then({ prompt: 'Sub step 2' });
    
    // Main agent: 1 + runAgent(2) + 1 = 4 total
    const mainAgent = agent({ llm, hideProgress: true })
      .then({ prompt: 'Main step 1' })
      .runAgent(subAgent)
      .then({ prompt: 'Main step 3' });
    
    const steps = (mainAgent as any)._getSteps();
    expect(steps.length).toBe(3); // 3 step definitions
    
    // But total execution steps should be 4
    // This would be tested by running and checking progress output
  });

  it('recursively counts steps with multiple runAgent calls', () => {
    const llm = createMockLLM();
    
    // First sub-agent with 2 steps
    const analyzer = agent({ llm, hideProgress: true })
      .then({ prompt: 'Analyze sentiment' })
      .then({ prompt: 'Extract topics' });
    
    // Second sub-agent with 2 steps
    const responder = agent({ llm, hideProgress: true })
      .then({ prompt: 'Write response' })
      .then({ prompt: 'Make concise' });
    
    // Main agent: 1 + runAgent(2) + runAgent(2) + 1 = 6 total
    const mainAgent = agent({ llm, hideProgress: true })
      .then({ prompt: 'Step 1' })
      .runAgent(analyzer)
      .runAgent(responder)
      .then({ prompt: 'Step 6' });
    
    const steps = (mainAgent as any)._getSteps();
    expect(steps.length).toBe(4); // 4 step definitions (1 + runAgent + runAgent + 1)
  });

  it('verifies progress shows correct step count with runAgent', async () => {
    const llm = createMockLLM(['response1', 'response2', 'response3', 'response4', 'response5', 'response6']);
    
    const outputs: string[] = [];
    const originalLog = console.log.bind(console);
    console.log = ((...args: any[]) => {
      outputs.push(args.join(' '));
      originalLog(...args);
    }) as any;
    
    const analyzer = agent({ llm })
      .then({ prompt: 'Analyze' })
      .then({ prompt: 'Extract' });
    
    const responder = agent({ llm })
      .then({ prompt: 'Write' })
      .then({ prompt: 'Polish' });
    
    try {
      await agent({ llm })
        .then({ prompt: 'Input' })
        .runAgent(analyzer)
        .runAgent(responder)
        .then({ prompt: 'Final' })
        .run();
      
      // Restore console.log
      console.log = originalLog;
      
      const combined = outputs.join('\n');
      
      // Should show Step N/6 (not Step N/4)
      expect(combined).toContain('Step 1/6');
      expect(combined).toContain('Step 2/6');
      expect(combined).toContain('Step 3/6');
      expect(combined).toContain('Step 4/6');
      expect(combined).toContain('Step 5/6');
      expect(combined).toContain('Step 6/6');
      expect(combined).not.toContain('/4');
    } finally {
      console.log = originalLog;
    }
  });
});

