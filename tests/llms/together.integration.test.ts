import { describe, it, expect } from 'vitest';
import { llmTogether } from '../../src/llms/together.js';

describe('Together provider (integration)', () => {
    const apiKey = process.env.TOGETHER_API_KEY;
    const model = process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';

    it('calls Together with live API when TOGETHER_API_KEY is set', async () => {
        if (!apiKey) {
            console.warn('Skipping Together integration test: TOGETHER_API_KEY not set');
            return;
        }

        const llm = llmTogether({ apiKey, model });
        const prompt = 'Echo exactly this token with no quotes, no punctuation, no extra text: VOLCANO_SDK_OK';

        const out = await llm.gen(prompt);
        console.log('Together gen output:', out);

        expect(typeof out).toBe('string');
        const normalized = out.trim().replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
        expect(normalized).toContain('VOLCANO_SDK_OK');
    }, 20000);

    it('streams response correctly', async () => {
        if (!apiKey) {
            return;
        }

        const llm = llmTogether({ apiKey, model });
        const prompt = 'Write a short sentence about volcanoes.';

        let streamed = '';
        const chunks: string[] = [];

        for await (const chunk of llm.genStream(prompt)) {
            expect(typeof chunk).toBe('string');
            streamed += chunk;
            chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(streamed.length).toBeGreaterThan(0);
        console.log('Together streamed output:', streamed);
    }, 30000);

    it('supports tools (if model supports it)', async () => {
        if (!apiKey) {
            return;
        }

        // Some smaller models might not support tools well, but Llama 3.1 should.
        const llm = llmTogether({ apiKey, model });

        const tools: any = [{
            name: 'get_current_weather',
            description: 'Get the current weather in a given location',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'The city and state, e.g. San Francisco, CA',
                    },
                    unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                },
                required: ['location'],
            },
        }];

        const prompt = 'What is the weather in San Francisco?';
        const result = await llm.genWithTools(prompt, tools);

        console.log('Together tool capability result:', JSON.stringify(result, null, 2));

        // We accept either a tool call or a text response (if the model decides not to call a tool),
        // but for this specific prompt and model, we expect a tool call.
        if (result.toolCalls) {
            expect(result.toolCalls.length).toBeGreaterThan(0);
            expect(result.toolCalls[0].name).toContain('get_current_weather');
        } else {
            // If it didn't call a tool, it should have some content
            expect(result.textContent).toBeTruthy();
            console.warn('Model did not call tool as expected, but returned text.');
        }
    }, 60000);
});
