import { describe, it, expect } from 'vitest';
import { agent, llmOpenAI } from '../src/volcano-sdk.js';
import { renderAnsi } from './progress.renderer.test.js';

describe('Hello-world progress formatting', () => {
  it('shows a blank line after each step Complete', { timeout: 30000 }, async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');

    const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini', options: { max_completion_tokens: 64, temperature: 0, top_p: 1 } });

    const logs: string[] = [];
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);

    console.log = (...args: any[]) => { logs.push(args.join(' ')); originalLog(...args); };
    process.stdout.write = (chunk: any): boolean => { logs.push(String(chunk)); return originalWrite(chunk); };

    try {
      await agent({ llm })
        .then({ prompt: 'Generate 3 random positive words' })
        .then({ prompt: 'Create 10 motivational quotes using those words' })
        .run();
    } finally {
      console.log = originalLog;
      process.stdout.write = originalWrite;
    }

    const output = renderAnsi(logs.join(''));

    // Verify Complete appears for both steps
    expect(output.includes('✅ Complete')).toBe(true);
    
    // CRITICAL: Verify no triple newlines anywhere
    expect(output).not.toMatch(/\n\n\n/);
    
    // CRITICAL: Verify both steps appear
    expect(output).toContain('🤖 Step 1/2');
    expect(output).toContain('🤖 Step 2/2');
    
    // CRITICAL: Verify final Agent complete with totals
    expect(output).toMatch(/🎉 Agent complete \| \d+ tokens \| \d+\.\d+s \| /);
  });
});


