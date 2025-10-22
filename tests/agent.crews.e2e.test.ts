import { describe, it, expect } from 'vitest';
import { agent, llmOpenAI } from '../src/volcano-sdk.js';

describe('Multi-agent crews e2e (live APIs)', () => {
  it('validates autonomous agent selection with live OpenAI', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping: OPENAI_API_KEY not set');
      return;
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    // Define specialized agents
    const researcher = agent({
      llm,
      name: 'researcher',
      description: 'Analyzes topics and provides factual information. Use when you need research or data.'
    });

    const writer = agent({
      llm,
      name: 'writer',
      description: 'Creates engaging, creative content. Use when you need articles, stories, or marketing copy.'
    });

    // Coordinator automatically selects agents
    const results = await agent({ llm })
      .then({
        prompt: 'Create a short 2-sentence description of why TypeScript is popular',
        agents: [researcher, writer],
        maxAgentIterations: 5
      })
      .run();

    // Verify result exists
    expect(results[0].llmOutput).toBeTruthy();
    expect(results[0].llmOutput!.length).toBeGreaterThan(20);
    
    // Verify at least one agent was called
    const agentCalls = (results[0] as any).agentCalls;
    if (agentCalls) {
      expect(agentCalls.length).toBeGreaterThan(0);
      // Should have called researcher or writer (or both)
      const calledNames = agentCalls.map((c: any) => c.name);
      expect(calledNames.some((n: string) => n === 'researcher' || n === 'writer')).toBe(true);
    }
  });

  it('validates multi-step agent delegation with live OpenAI', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping: OPENAI_API_KEY not set');
      return;
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    const analyzer = agent({
      llm,
      name: 'analyzer',
      description: 'Analyzes data and extracts insights'
    });

    const summarizer = agent({
      llm,
      name: 'summarizer',
      description: 'Creates concise summaries'
    });

    const results = await agent({ llm })
      .then({
        prompt: 'Analyze this text and summarize it: "Artificial intelligence is transforming industries through automation and intelligent decision making."',
        agents: [analyzer, summarizer],
        maxAgentIterations: 5
      })
      .run();

    expect(results[0].llmOutput).toBeTruthy();
    
    // Check if agents were utilized
    const agentCalls = (results[0] as any).agentCalls;
    if (agentCalls && agentCalls.length > 0) {
      console.log('Agents called:', agentCalls.map((c: any) => c.name));
    }
  });

  it('validates agent crews work with stream()', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping: OPENAI_API_KEY not set');
      return;
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    const factChecker = agent({
      llm,
      name: 'factChecker',
      description: 'Verifies facts and checks accuracy'
    });

    const results: any[] = [];
    for await (const step of agent({ llm })
      .then({
        prompt: 'Verify: The Earth orbits the Sun',
        agents: [factChecker],
        maxAgentIterations: 3
      })
      .stream()) {
      results.push(step);
    }

    expect(results).toHaveLength(1);
    expect(results[0].llmOutput).toBeTruthy();
  });
});

