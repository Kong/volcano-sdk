import type { LLMHandle } from "./types.js";

type OpenAILikeClient = {
  chat: { completions: { create: (args: { model: string; messages: Array<{ role: string; content: string }> }) => Promise<any> } };
};

export type MistralConfig = {
  model?: string;
  client?: OpenAILikeClient;
  apiKey?: string;
  baseURL?: string; // default https://api.mistral.ai
};

export function llmMistral(cfg: MistralConfig): LLMHandle {
  const model = cfg.model || "mistral-small-latest";
  let client = cfg.client;

  if (!client && (cfg.apiKey || cfg.baseURL)) {
    const base = (cfg.baseURL || "https://api.mistral.ai").replace(/\/$/, "");
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
              const err: any = new Error(`Mistral HTTP ${res.status}`);
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
    throw new Error("llmMistral: provide either client or (apiKey/baseURL) for a Mistral endpoint");
  }

  return {
    id: `Mistral-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const resp = await client!.chat.completions.create({ model, messages: [{ role: "user", content: prompt }] });
      const msg = resp?.choices?.[0]?.message?.content ?? resp?.choices?.[0]?.text ?? "";
      return typeof msg === "string" ? msg : JSON.stringify(msg);
    },
    async genWithTools(): Promise<any> {
      throw new Error("llmMistral: tool calling is not yet supported in Volcano SDK");
    },
    async *genStream(): AsyncGenerator<string, void, unknown> {
      throw new Error("llmMistral: streaming not yet implemented");
    },
  };
}


