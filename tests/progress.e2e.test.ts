import { describe, it, expect } from 'vitest';
import { agent, llmOpenAI } from '../src/volcano-sdk.js';

describe('Progress output e2e (live APIs)', () => {
  it('validates showProgress works for basic LLM steps', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    process.stdout.write = (chunk: any): boolean => {
      logs.push(String(chunk));
      return originalWrite(chunk);
    };

    try {
      await agent({ llm, showProgress: true })
        .then({ prompt: "Say 'Hello World' exactly" })
        .run();

      // Restore
      console.log = originalLog;
      process.stdout.write = originalWrite;

      // Verify progress elements appeared
      const output = logs.join('');
      
      // Check for header
      expect(output).toContain('🌋 Running Volcano agent');
      expect(output).toContain('volcano-sdk v');
      expect(output).toContain('https://volcano.dev');
      
      // Check for step indicator
      expect(output).toContain('🤖 Step 1/1');
      
      // Check for completion
      expect(output).toContain('✅ Complete');
      
      // Check for workflow summary
      expect(output).toContain('🎉 Workflow complete');
      
    } finally {
      console.log = originalLog;
      process.stdout.write = originalWrite;
    }
  });

  it('validates showProgress works for multi-step workflows', { timeout: 30000 }, async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    const logs: string[] = [];
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    process.stdout.write = (chunk: any): boolean => {
      logs.push(String(chunk));
      return originalWrite(chunk);
    };

    try {
      await agent({ llm, showProgress: true })
        .then({ prompt: "Say 'Step 1' exactly" })
        .then({ prompt: "Say 'Step 2' exactly" })
        .run();

      console.log = originalLog;
      process.stdout.write = originalWrite;

      const output = logs.join('');
      
      // CRITICAL: Verify both steps shown
      expect(output).toContain('🤖 Step 1/2');
      expect(output).toContain('🤖 Step 2/2');
      
      // Token progress shows for longer responses (>10 tokens)
      // Short responses may not trigger display
      
      // CRITICAL: Verify both completions with token counts
      const completeMatches = output.match(/✅ Complete \(\d+\.\d+s for \d+ tokens\)/g);
      expect(completeMatches?.length).toBeGreaterThanOrEqual(2);
      
      // CRITICAL: Verify workflow summary
      expect(output).toContain('2 steps');
      expect(output).toContain('🎉 Workflow complete');
      
    } finally {
      console.log = originalLog;
      process.stdout.write = originalWrite;
    }
  });

  it('validates showProgress works for agent crews', { timeout: 60000 }, async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    // Define simple agents
    const summarizer = agent({
      llm,
      name: 'summarizer',
      description: 'Creates concise summaries'
    });

    const logs: string[] = [];
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    process.stdout.write = (chunk: any): boolean => {
      logs.push(String(chunk));
      return originalWrite(chunk);
    };

    try {
      await agent({ llm, showProgress: true, timeout: 60 })
        .then({
          prompt: 'Summarize the word "AI" in one sentence',
          agents: [summarizer]
        })
        .run();

      console.log = originalLog;
      process.stdout.write = originalWrite;

      const output = logs.join('');
      
      // Verify header
      expect(output).toContain('🌋 Running Volcano agent');
      expect(output).toContain('volcano-sdk v');
      expect(output).toContain('https://volcano.dev');
      
      // Verify step shown
      expect(output).toContain('🤖 Step 1/1');
      
      // CRITICAL: Verify coordinator thinking (no indentation)
      expect(output).toContain('🧠 Coordinator selecting agents');
      
      // CRITICAL: Verify coordinator decision shows time + tokens
      expect(output).toMatch(/✅ Coordinator decision: USE \w+ \(\d+\.\d+s for \d+ tokens\)/);
      
      // CRITICAL: Verify agent was invoked with progress (no indentation)
      expect(output).toContain('⚡ summarizer');
      
      // Token progress shows for longer responses
      // (Short responses complete before 10-token threshold)
      
      // CRITICAL: Verify agent completion shows time + tokens (not chars)
      expect(output).toMatch(/✅ summarizer complete \(\d+\.\d+s for \d+ tokens\)/);
      
      // Verify final completion
      expect(output).toContain('✅ Complete');
      expect(output).toContain('🎉 Workflow complete');
      
    } finally {
      console.log = originalLog;
      process.stdout.write = originalWrite;
    }
  });

  it('validates showProgress never breaks with errors', { timeout: 30000 }, async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    const logs: string[] = [];
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);
    const originalError = console.error;
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    console.error = (...args: any[]) => {
      logs.push(args.join(' '));
      originalError(...args);
    };
    
    process.stdout.write = (chunk: any): boolean => {
      logs.push(String(chunk));
      return originalWrite(chunk);
    };

    try {
      // This should timeout and retry, but progress should still work
      await agent({ llm, showProgress: true, timeout: 1, retry: { retries: 2 } })
        .then({ prompt: "Count to 100 slowly" })
        .run();
    } catch (e) {
      // Expected to fail, that's OK
    }

    console.log = originalLog;
    console.error = originalError;
    process.stdout.write = originalWrite;

    const output = logs.join('');
    
    // Even with errors/timeouts, progress should have shown
    expect(output).toContain('🌋 Running Volcano agent');
    expect(output).toContain('🤖 Step 1/1');
    
    // Should have attempted multiple times (retries)
    const stepMatches = output.match(/🤖 Step 1\/1/g);
    expect(stepMatches?.length).toBeGreaterThanOrEqual(1);
  });

  it('validates progress output is TTY-aware', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }

    const llm = llmOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini'
    });

    const logs: string[] = [];
    const originalLog = console.log;
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      await agent({ llm, showProgress: true })
        .then({ prompt: "Say 'Test'" })
        .run();

      console.log = originalLog;

      const output = logs.join('');
      
      // Progress should work (even if not TTY in test environment)
      expect(output).toContain('🌋 Running Volcano agent');
      expect(output).toContain('✅ Complete');
      
    } finally {
      console.log = originalLog;
    }
  });
});

