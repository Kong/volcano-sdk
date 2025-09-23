import type { LLMHandle } from "./types.js";

type AnthropicLikeClient = {
  messages: {
    create: (args: { model: string; max_tokens?: number; messages: Array<{ role: "user" | "assistant"; content: string }> }) => Promise<any>;
  };
};

export type AnthropicConfig = {
  model?: string;
  client?: AnthropicLikeClient;
  apiKey?: string;
  baseURL?: string; // default https://api.anthropic.com
  version?: string; // default 2023-06-01
};

export function llmAnthropic(cfg: AnthropicConfig): LLMHandle {
  const model = cfg.model || "claude-4-sonnet";
  const apiKey = cfg.apiKey;
  const baseURL = (cfg.baseURL || "https://api.anthropic.com").replace(/\/$/, "");
  const version = cfg.version || "2023-06-01";

  let client: AnthropicLikeClient | undefined = cfg.client;

  if (!client && apiKey) {
    client = {
      messages: {
        create: async ({ model, max_tokens = 512, messages }) => {
          const res = await fetch(`${baseURL}/v1/messages`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey!,
              "anthropic-version": version,
            },
            body: JSON.stringify({ model, max_tokens, messages }),
          });
          if (!res.ok) {
            const text = await res.text();
            const err: any = new Error(`Anthropic HTTP ${res.status}`);
            err.status = res.status;
            err.body = text;
            throw err;
          }
          return await res.json();
        },
      },
    } as AnthropicLikeClient;
  }

  if (!client) {
    throw new Error("llmAnthropic: provide either client or apiKey");
  }

  return {
    id: `Anthropic-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const resp = await client!.messages.create({ model, max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      const text = resp?.content?.[0]?.text ?? resp?.content ?? "";
      return typeof text === "string" ? text : JSON.stringify(text);
    },
    async genWithTools(): Promise<any> {
      throw new Error("llmAnthropic: tool calling is not yet supported in Volcano SDK");
    },
    async *genStream(): AsyncGenerator<string, void, unknown> {
      throw new Error("llmAnthropic: streaming not yet implemented");
    },
  };
}


