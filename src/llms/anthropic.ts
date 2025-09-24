import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";

type AnthropicLikeClient = {
  messages: {
    create: (args: { model: string; max_tokens?: number; messages: Array<{ role: "user" | "assistant"; content: string }>; tools?: any[]; tool_choice?: any }) => Promise<any>;
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
        create: async ({ model, max_tokens = 512, messages, tools, tool_choice }) => {
          const payload: any = { model, max_tokens, messages };
          if (tools && tools.length > 0) {
            payload.tools = tools;
          }
          if (tool_choice) {
            payload.tool_choice = tool_choice;
          }
          
          const res = await fetch(`${baseURL}/v1/messages`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey!,
              "anthropic-version": version,
            },
            body: JSON.stringify(payload),
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
            };
            
            // Handle tool_choice conversion from OpenAI format to Anthropic format
            if (tool_choice && mappedTools.length > 0) {
              if (tool_choice === "auto") {
                payload.tool_choice = { type: "auto" };
              } else if (tool_choice === "none") {
                // Don't set tool_choice, let Anthropic decide
              } else if (typeof tool_choice === "object" && tool_choice.type === "function") {
                payload.tool_choice = { type: "tool", name: tool_choice.function?.name };
              } else {
                payload.tool_choice = { type: "auto" };
              }
            }
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

      // Use the OpenAI-compatible shim that handles tools properly
      const resp = await (client as any).chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: openaiTools,
        tool_choice: "auto",
      });

      const message: any = resp.choices?.[0]?.message as any;
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

      return {
        content: message?.content || undefined,
        toolCalls,
      };
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
      
      // If no async iterator, the streaming is not properly configured
      throw new Error('Anthropic streaming not available - check client configuration');
    },
  };
}


