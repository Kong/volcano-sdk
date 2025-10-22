import { describe, it, expect } from 'vitest';
import { agent } from '../dist/volcano-sdk.js';

describe('agent streaming', () => {
  it('streams step results as they complete', async () => {
    const stepResults: any[] = [];
    const llm: any = { 
      id: 'mock', 
      model: 'm', 
      client: {}, 
      gen: async (prompt: string) => `Response to: ${prompt}`, 
      genWithTools: async () => ({ content: '', toolCalls: [] }), 
      genStream: async function*(){} 
    };

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'First step' })
      .then({ prompt: 'Second step' })
      .then({ prompt: 'Third step' })
      .stream()) {
      stepResults.push(stepResult);
    }

    expect(stepResults).toHaveLength(3);
    expect(stepResults[0].prompt).toBe('First step');
    expect(stepResults[1].prompt).toBe('Second step');
    expect(stepResults[2].prompt).toBe('Third step');
    expect(stepResults[0].llmOutput).toContain('First step');
    expect(stepResults[1].llmOutput).toContain('Second step');
    expect(stepResults[2].llmOutput).toContain('Third step');
  });

  it('yields results incrementally with timing information', async () => {
    const stepResults: any[] = [];
    const timestamps: number[] = [];
    const llm: any = { 
      id: 'mock', 
      model: 'm', 
      client: {}, 
      gen: async () => { 
        await new Promise(r => setTimeout(r, 10)); // Small delay to simulate work
        return 'OK'; 
      }, 
      genWithTools: async () => ({ content: '', toolCalls: [] }), 
      genStream: async function*(){} 
    };

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'Step 1' })
      .then({ prompt: 'Step 2' })
      .stream()) {
      timestamps.push(Date.now());
      stepResults.push(stepResult);
    }

    expect(stepResults).toHaveLength(2);
    expect(timestamps).toHaveLength(2);
    // Verify steps are yielded incrementally, not all at once
    expect(timestamps[1] - timestamps[0]).toBeGreaterThan(5);
    expect(stepResults[0].durationMs).toBeGreaterThan(0);
    expect(stepResults[1].durationMs).toBeGreaterThan(0);
  });

  it('streaming supports pre/post hooks', async () => {
    const events: string[] = [];
    const stepResults: any[] = [];
    const llm: any = { 
      id: 'mock', 
      model: 'm', 
      client: {}, 
      gen: async () => 'OK', 
      genWithTools: async () => ({ content: '', toolCalls: [] }), 
      genStream: async function*(){} 
    };

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ 
        prompt: 'Test with hooks',
        pre: () => { events.push('pre-executed'); },
        post: () => { events.push('post-executed'); }
      })
      .stream()) {
      stepResults.push(stepResult);
    }

    expect(events).toEqual(['pre-executed', 'post-executed']);
    expect(stepResults).toHaveLength(1);
    expect(stepResults[0].llmOutput).toBe('OK');
  });

  it('streaming works with LLM-only steps', async () => {
    const stepResults: any[] = [];
    const llm: any = { 
      id: 'mock', 
      model: 'm', 
      client: {}, 
      gen: async (prompt: string) => `Processed: ${prompt}`, 
      genWithTools: async () => ({ content: '', toolCalls: [] }), 
      genStream: async function*(){} 
    };

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'Analyze this data' }) // LLM-only step (no mcps)
      .stream()) {
      stepResults.push(stepResult);
    }

    expect(stepResults).toHaveLength(1);
    expect(stepResults[0].prompt).toBe('Analyze this data');
    expect(stepResults[0].llmOutput).toBe('Processed: Analyze this data');
    expect(typeof stepResults[0].durationMs).toBe('number');
  });

  it('streaming calls log callback correctly', async () => {
    const loggedSteps: any[] = [];
    const loggedIndices: number[] = [];
    const streamedResults: any[] = [];
    
    const llm: any = { 
      id: 'mock', 
      model: 'm', 
      client: {}, 
      gen: async (prompt: string) => `Response: ${prompt}`, 
      genWithTools: async () => ({ content: '', toolCalls: [] }), 
      genStream: async function*(){} 
    };

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'First' })
      .then({ prompt: 'Second' })
      .stream((step, stepIndex) => {
        loggedSteps.push(step);
        loggedIndices.push(stepIndex);
      })) {
      streamedResults.push(stepResult);
    }

    // Verify both streaming and logging work
    expect(streamedResults).toHaveLength(2);
    expect(loggedSteps).toHaveLength(2);
    expect(loggedIndices).toEqual([0, 1]);
    expect(loggedSteps[0].prompt).toBe('First');
    expect(loggedSteps[1].prompt).toBe('Second');
  });

  it('prevents concurrent streaming like run()', async () => {
    const llm: any = { 
      id: 'mock', 
      model: 'm', 
      client: {}, 
      gen: async () => 'OK', 
      genWithTools: async () => ({ content: '', toolCalls: [] }), 
      genStream: async function*(){} 
    };

    const workflow = agent({ llm, hideProgress: true }).then({ prompt: 'test' });
    
    let concurrencyError: any;
    let stream1Results: any[] = [];
    
    try {
      // Start first stream
      const stream1 = workflow.stream();
      const firstResult = await stream1.next();
      stream1Results.push(firstResult.value);
      
      // Try to start second stream while first is running
      try {
        const stream2 = workflow.stream();
        await stream2.next();
      } catch (e) {
        concurrencyError = e;
      }
      
      // Finish consuming first stream
      for await (const step of stream1) {
        stream1Results.push(step);
      }
      
    } catch (e) {
      // The concurrency error might be thrown here
      concurrencyError = e;
    }

    expect(concurrencyError?.name).toBe('AgentConcurrencyError');
    expect(stream1Results.length).toBeGreaterThan(0);
  });
});
