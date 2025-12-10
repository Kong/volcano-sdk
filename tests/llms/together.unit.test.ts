import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { llmTogether } from "../../src/llms/together.js";

describe("llmTogether", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        // Mock global fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.clearAllMocks();
    });

    it("should throw if model is missing", () => {
        expect(() => llmTogether({} as any)).toThrow("Missing required 'model' parameter");
    });

    it("should throw if apiKey/client is missing", () => {
        expect(() => llmTogether({ model: "test-model" })).toThrow("Missing configuration");
    });

    it("should generate text using fetch", async () => {
        const mockResponse = {
            choices: [
                {
                    message: {
                        content: "Hello from Together!",
                    },
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const llm = llmTogether({
            apiKey: "test-key",
            model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        });

        const result = await llm.gen("Hi");
        expect(result).toBe("Hello from Together!");

        // Verify fetch call
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.together.xyz/v1/chat/completions",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "content-type": "application/json",
                    Authorization: "Bearer test-key",
                }),
                body: expect.stringContaining('"model":"mistralai/Mixtral-8x7B-Instruct-v0.1"'),
            })
        );
    });

    it("should use custom baseURL if provided", async () => {
        const mockResponse = {
            choices: [{ message: { content: "Custom URL working" } }],
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const llm = llmTogether({
            apiKey: "test-key",
            model: "test-model",
            baseURL: "https://my-proxy.com/v1",
        });

        await llm.gen("test");

        expect(global.fetch).toHaveBeenCalledWith(
            "https://my-proxy.com/v1/chat/completions",
            expect.any(Object)
        );
    });
});
