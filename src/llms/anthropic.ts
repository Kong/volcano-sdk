import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";

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
      // Provide an OpenAI-compatible shim so generic agent flows can use tool selection
      chat: {
        completions: {
          create: async (args: any) => {
            const { model, messages, tools, tool_choice } = args || {};
            const mappedTools = (tools || []).map((t: any) => ({
              name: t?.function?.name,
              description: t?.function?.description,
              input_schema: t?.function?.parameters,
            }));
            const payload: any = {
              model,
              max_tokens: 512,
              messages,
              ...(mappedTools.length ? { tools: mappedTools } : {}),
              ...(tool_choice ? { tool_choice } : {}),
            };
            const resp: any = await (client as any).messages.create(payload);
            const blocks: any[] = resp?.content || resp?.message?.content || [];
            const text = blocks.filter(b => b?.type === 'text').map(b => b?.text || '').join('');
            const toolCalls = blocks.filter(b => b?.type === 'tool_use').map((b: any) => ({
              id: b?.id,
              type: 'function',
              function: {
                name: b?.name,
                arguments: JSON.stringify(b?.input || {}),
              },
            }));
            return { choices: [{ message: { content: text, tool_calls: toolCalls } }] };
          },
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
    async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
      const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
      const anthropicTools = tools.map((tool) => {
        const dottedName = tool.name;
        const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
        nameMap.set(sanitized, { dottedName, def: tool });
        return {
          name: sanitized,
          description: tool.description,
          input_schema: tool.parameters,
        } as any;
      });
      const payload: any = { model, max_tokens: 256, messages: [{ role: "user", content: prompt }], tools: anthropicTools, tool_choice: "auto" };
      const resp = await client!.messages.create(payload);
      const content = resp?.content || resp?.message?.content || [];
      const toolCalls: any[] = [];
      for (const block of content) {
        if (block?.type === 'tool_use') {
          const sanitizedName: string = block?.name || '';
          const mapped = nameMap.get(sanitizedName);
          toolCalls.push({
            name: mapped?.dottedName ?? sanitizedName,
            arguments: block?.input || {},
            mcpHandle: mapped?.def?.mcpHandle,
          });
        }
      }
      const text = (() => {
        const t = content.find((c: any) => c?.type === 'text')?.text;
        return typeof t === 'string' ? t : undefined;
      })();
      return { content: text, toolCalls };
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      // Native streaming using messages.create with stream: true
      const streamResp: any = await (client as any).messages.create({ model, max_tokens: 256, messages: [{ role: "user", content: prompt }], stream: true });
      // The official Anthropic SDK exposes an async iterator on streamResp
      if (streamResp && typeof streamResp[Symbol.asyncIterator] === 'function') {
        for await (const event of streamResp) {
          const delta = event?.delta?.text || event?.delta || event?.text;
          if (typeof delta === 'string' && delta.length > 0) yield delta;
        }
        return;
      }
      // Fallback to single-shot if streaming not available
      const text = await this.gen(prompt);
      if (text) yield text;
    },
  };
}


