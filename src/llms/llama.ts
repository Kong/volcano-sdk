import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";

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
    async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
      const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
      const openaiTools = tools.map((tool) => {
        const dottedName = tool.name;
        const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        nameMap.set(sanitized, { dottedName, def: tool });
        return {
          type: "function" as const,
          function: {
            name: sanitized,
            description: tool.description,
            parameters: tool.parameters,
          },
        };
      });
      const resp = await client!.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: openaiTools as any,
        tool_choice: "auto" as any,
      } as any);
      const message: any = resp?.choices?.[0]?.message ?? {};
      const rawCalls: any[] = (message?.tool_calls ?? []) as any[];
      const toolCalls = rawCalls.map((call: any) => {
        const sanitizedName: string = call?.function?.name ?? call?.name ?? "";
        const mapped = nameMap.get(sanitizedName);
        const argsJson: string = call?.function?.arguments ?? call?.arguments ?? "{}";
        const parsedArgs = (() => { try { return JSON.parse(argsJson); } catch { return {}; } })();
        const mcpHandle = mapped?.def.mcpHandle;
        return {
          name: mapped?.dottedName ?? sanitizedName,
          arguments: parsedArgs,
          mcpHandle,
        };
      });
      return { content: message?.content || undefined, toolCalls };
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      const stream: any = await client!.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true as any,
      } as any);
      for await (const chunk of stream as any) {
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield delta;
        }
      }
    },
  };
}


