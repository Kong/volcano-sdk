import type { LLMHandle } from "./types.js";

type OpenAILikeClient = {
  chat: { completions: { create: (args: { model: string; messages: Array<{ role: string; content: string }> }) => Promise<any> } };
};

export type LlamaConfig = {
  model?: string;
  client?: OpenAILikeClient; // e.g., local OpenAI-compatible server (Ollama/OpenRouter/etc.)
  apiKey?: string;           // optional; if provided, we use fetch with Authorization: Bearer
  baseURL?: string;          // optional; default http://localhost:11434 or provider endpoint
};

export function llmLlama(cfg: LlamaConfig): LLMHandle {
  const model = cfg.model || "llama3-8b-instruct";
  let client = cfg.client;

  if (!client && (cfg.apiKey || cfg.baseURL)) {
    const base = (cfg.baseURL || "http://localhost:11434").replace(/\/$/, "");
    const apiKey = cfg.apiKey;
    client = {
      chat: {
        completions: {
          create: async ({ model, messages }) => {
            const res = await fetch(`${base}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              },
              body: JSON.stringify({ model, messages }),
            });
            if (!res.ok) {
              const text = await res.text();
              const err: any = new Error(`Llama HTTP ${res.status}`);
              err.status = res.status;
              err.body = text;
              throw err;
            }
            return await res.json();
          },
        },
      },
    } as OpenAILikeClient;
  }

  if (!client) {
    throw new Error("llmLlama: provide either client or (apiKey/baseURL) for an OpenAI-compatible endpoint");
  }

  return {
    id: `Llama-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const resp = await client!.chat.completions.create({ model, messages: [{ role: "user", content: prompt }] });
      const msg = resp?.choices?.[0]?.message?.content ?? resp?.choices?.[0]?.text ?? "";
      return typeof msg === "string" ? msg : JSON.stringify(msg);
    },
    async genWithTools(): Promise<any> {
      throw new Error("llmLlama: tool calling is not yet supported in Volcano SDK");
    },
    async *genStream(): AsyncGenerator<string, void, unknown> {
      throw new Error("llmLlama: streaming not yet implemented");
    },
  };
}


