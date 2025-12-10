import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";
import { createOpenAICompatibleTools, parseOpenAICompatibleResponse } from "./utils.js";
import { normalizeTokenUsage } from "../token-utils.js";

type OpenAILikeClient = {
    chat: { completions: { create: (args: any) => Promise<any> } };
};

export type TogetherOptions = {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    stop?: string | string[];
};

export type TogetherConfig = {
    model: string; // Required - be explicit about which model to use
    client?: OpenAILikeClient;
    apiKey?: string;
    baseURL?: string; // default https://api.together.xyz/v1
    options?: TogetherOptions;
};

export function llmTogether(cfg: TogetherConfig): LLMHandle {
    if (!cfg.model) {
        throw new Error(
            "llmTogether: Missing required 'model' parameter. " +
            "Please specify which Together model to use. " +
            "Example: llmTogether({ apiKey: 'your-key', model: 'meta-llama/Llama-3-70b-chat-hf' })"
        );
    }
    const model = cfg.model;
    const options = cfg.options || {};
    let lastUsage: import('./types').TokenUsage | null = null;
    let client = cfg.client;

    if (!client && (cfg.apiKey || cfg.baseURL)) {
        const base = (cfg.baseURL || "https://api.together.xyz/v1").replace(/\/$/, "");
        const apiKey = cfg.apiKey;
        client = {
            chat: {
                completions: {
                    create: async (params) => {
                        const res = await fetch(`${base}/chat/completions`, {
                            method: "POST",
                            headers: {
                                "content-type": "application/json",
                                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                            },
                            body: JSON.stringify(params),
                        });
                        if (!res.ok) {
                            const text = await res.text();
                            const err: any = new Error(`Together HTTP ${res.status}`);
                            err.status = res.status;
                            err.body = text;
                            throw err;
                        }

                        if (params.stream) {
                            return res; // Return the response object for streaming
                        }

                        return await res.json();
                    },
                },
            },
        } as OpenAILikeClient;
    }

    if (!client) {
        throw new Error(
            "llmTogether: Missing configuration. " +
            "Please provide either 'client' or 'apiKey' for Together API. " +
            "Example: llmTogether({ apiKey: 'your-key', model: 'meta-llama/Llama-3-70b-chat-hf' })"
        );
    }

    return {
        id: `Together-${model}`,
        model,
        client,
        async gen(prompt: string): Promise<string> {
            const resp = await client!.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                ...options,
            });

            lastUsage = normalizeTokenUsage(resp.usage);

            const msg = resp?.choices?.[0]?.message?.content ?? resp?.choices?.[0]?.text ?? "";
            return typeof msg === "string" ? msg : JSON.stringify(msg);
        },
        async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
            const { nameMap, formattedTools } = createOpenAICompatibleTools(tools);

            const resp = await client!.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                tools: formattedTools as any,
                tool_choice: "auto" as any,
                ...options,
            } as any);

            lastUsage = normalizeTokenUsage(resp.usage);

            const message = resp?.choices?.[0]?.message;
            const result = parseOpenAICompatibleResponse(message, nameMap);
            result.usage = lastUsage || undefined;
            return result;
        },
        async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
            const streamResponse: any = await client!.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                stream: true,
                ...options,
            });

            if (streamResponse && streamResponse.body) {
                const reader = streamResponse.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // Keep incomplete line in buffer

                        for (const line of lines) {
                            if (line.trim() === '' || line.startsWith(':')) continue;
                            if (line === 'data: [DONE]') return;
                            if (line.startsWith('data: ')) {
                                try {
                                    const jsonData = line.slice(6); // Remove 'data: ' prefix
                                    const parsed = JSON.parse(jsonData);
                                    const delta = parsed?.choices?.[0]?.delta?.content;
                                    if (typeof delta === 'string' && delta.length > 0) {
                                        yield delta;
                                    }
                                } catch {
                                    // Skip malformed JSON lines
                                    continue;
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
                return;
            }

            // If no response body, something went wrong
            throw new Error('No response body received from Together streaming endpoint');
        },
        getUsage: () => lastUsage
    };
}
