import { describe, it, expect } from 'vitest';
import { agent, llmOpenAI } from '../src/volcano-sdk.js';
import { renderAnsi } from './progress.renderer.test.js';

describe('Progress spacing and clearing (e2e)', () => {
  it('ensures coordinator/agent spacing has no doubles and clears interim lines', { timeout: 90000 }, async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');

    const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini', options: { max_completion_tokens: 64, temperature: 0, top_p: 1 } });

    // Build two simple agents to force coordinator -> agent -> coordinator flow
    const researcher = agent({ llm, name: 'researcher', description: 'Research facts' });
    const writer = agent({ llm, name: 'writer', description: 'Write content' });

    const logs: string[] = [];
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);

    console.log = (...args: any[]) => { logs.push(args.join(' ')); originalLog(...args); };
    process.stdout.write = (chunk: any): boolean => { logs.push(String(chunk)); return originalWrite(chunk); };

    try {
      await agent({ llm, timeout: 45 })
        .then({
          prompt: 'Pick an agent then finalize in one sentence.',
          agents: [researcher, writer],
          maxAgentIterations: 2
        })
        .run();
    } finally {
      console.log = originalLog;
      process.stdout.write = originalWrite;
    }

    const outputRaw = logs.join('');
    const output = renderAnsi(outputRaw);

    // No duplicate blank lines between coordinator/agent sections
    expect(output).not.toMatch(/\n\n\n/);

    // Coordinator decision lines must exist (new format: decision on one line)
    expect(output).toMatch(/🧠 Coordinator decision: USE \w+/);

    // Coordinator decision followed by Complete line
    expect(output).toMatch(/🧠 Coordinator decision: USE \w+\n\s+✅ Complete/);
    
    // Agent header appears
    expect(output).toMatch(/⚡ \w+ →/);
    
    // Final complete shows totals (including tool calls)
    expect(output).toMatch(/🎉 Agent complete \| \d+ tokens \| \d+ tool calls? \| \d+\.\d+s \| /);

    // Waiting line should not remain once tokens show (renderer strips it)
    expect(output).toContain('💭');
  });
});


