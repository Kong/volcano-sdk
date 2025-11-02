import { describe, it, expect } from 'vitest';
import { agent, llmOpenAI, llmVertexStudio } from '../dist/volcano-sdk.js';

describe('agent streaming (live APIs)', () => {
  it('streams OpenAI workflow results in real-time', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for this test');
    }

    const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-5-mini' });
    const stepResults: any[] = [];
    const timestamps: number[] = [];

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'Say "Step 1 complete"' })
      .then({ prompt: 'Say "Step 2 complete"' })
      .stream((step, stepIndex) => {
        console.log(`Live streaming - Step ${stepIndex + 1}: ${step.llmOutput}`);
      })) {
      timestamps.push(Date.now());
      stepResults.push(stepResult);
    }

    expect(stepResults).toHaveLength(2);
    expect(stepResults[0].llmOutput).toContain('Step 1');
    expect(stepResults[1].llmOutput).toContain('Step 2');
    expect(timestamps[1] - timestamps[0]).toBeGreaterThan(100); // Real delay between steps
  }, 30000);

  it('streams Vertex Studio workflow results', async () => {
    if (!process.env.GCP_VERTEX_API_KEY) {
      throw new Error('GCP_VERTEX_API_KEY is required for this test');
    }

    const llm = llmVertexStudio({ 
      apiKey: process.env.GCP_VERTEX_API_KEY!, 
      model: 'gemini-2.5-flash-lite' 
    });
    const stepResults: any[] = [];

    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'Reply with: VERTEX_STREAM_1' })
      .then({ prompt: 'Reply with: VERTEX_STREAM_2' })
      .stream()) {
      stepResults.push(stepResult);
      console.log(`Vertex streaming result: ${stepResult.llmOutput}`);
    }

    expect(stepResults).toHaveLength(2);
    expect(stepResults[0].llmOutput).toContain('VERTEX_STREAM_1');
    expect(stepResults[1].llmOutput).toContain('VERTEX_STREAM_2');
  }, 30000);

  it('compares streaming vs run() for same workflow', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for this test');
    }

    const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-5-mini' });
    
    const runResults = await agent({ llm, hideProgress: true })
      .then({ prompt: 'Count to 2' })
      .then({ prompt: 'Say done' })
      .run();

    const streamResults: any[] = [];
    for await (const stepResult of agent({ llm, hideProgress: true })
      .then({ prompt: 'Count to 2' })
      .then({ prompt: 'Say done' })
      .stream()) {
      streamResults.push(stepResult);
    }

    // Both should produce equivalent results
    expect(streamResults).toHaveLength(runResults.length);
    expect(streamResults[0].prompt).toBe(runResults[0].prompt);
    expect(streamResults[1].prompt).toBe(runResults[1].prompt);
    // Content may vary slightly due to LLM non-determinism, so just check structure
    expect(typeof streamResults[0].llmOutput).toBe('string');
    expect(typeof streamResults[1].llmOutput).toBe('string');
  }, 30000);
});
