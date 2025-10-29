import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";
import { createOpenAICompatibleTools, parseOpenAICompatibleResponse } from "./utils.js";

type AnthropicLikeClient = {
  messages: {
    create: (args: { model: string; max_tokens?: number; messages: Array<{ role: "user" | "assistant"; content: string }>; tools?: any[]; tool_choice?: any; stream?: boolean }) => Promise<any>;
  };
};

export type AnthropicOptions = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  thinking?: {
    type: "enabled" | "disabled";
    budget_tokens?: number;
  };
};

export type AnthropicConfig = {
  model: string; // Required - be explicit about which model to use
  client?: AnthropicLikeClient;
  apiKey?: string;
  baseURL?: string; // default https://api.anthropic.com
  version?: string; // default 2023-06-01
  options?: AnthropicOptions;
};

export function llmAnthropic(cfg: AnthropicConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error(
      "llmAnthropic: Missing required 'model' parameter. " +
      "Please specify which Claude model to use. " +
      "Example: llmAnthropic({ apiKey: 'sk-ant-...', model: 'claude-3-haiku-20240307' })"
    );
  }
  const model = cfg.model;
  const apiKey = cfg.apiKey;
  const baseURL = (cfg.baseURL || "https://api.anthropic.com").replace(/\/$/, "");
  const version = cfg.version || "2023-06-01";
  const options = cfg.options || {};
  let lastUsage: import('./types').TokenUsage | null = null;

  let client: AnthropicLikeClient | undefined = cfg.client;

  if (!client && apiKey) {
    client = {
      messages: {
        create: async ({ model, max_tokens = 512, messages, tools, tool_choice, stream }) => {
          const payload: any = { model, max_tokens, messages };
          if (tools && tools.length > 0) {
            payload.tools = tools;
          }
          if (tool_choice) {
            payload.tool_choice = tool_choice;
          }
          if (stream) {
            payload.stream = true;
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
          
          // Handle streaming responses
          if (stream) {
            return {
              body: res.body,
              [Symbol.asyncIterator]: async function* () {
                if (!res.body) return;
                
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                      if (line.trim() === '' || line.startsWith(':')) continue;
                      if (line === 'data: [DONE]') return;
                      if (line.startsWith('data: ')) {
                        try {
                          const jsonData = line.slice(6);
                          const parsed = JSON.parse(jsonData);
                          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                            yield { delta: { text: parsed.delta.text } };
                          }
                        } catch {
                          continue;
                        }
                      }
                    }
                  }
                } finally {
                  reader.releaseLock();
                }
              }
            };
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
    throw new Error(
      "llmAnthropic: Missing configuration. " +
      "Please provide either 'client' or 'apiKey' in the config object. " +
      "Example: llmAnthropic({ apiKey: 'sk-ant-...' })"
    );
  }

  return {
    id: `Anthropic-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const resp = await client!.messages.create({ 
        model, 
        max_tokens: options.max_tokens || 256, 
        messages: [{ role: "user", content: prompt }],
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.top_p !== undefined && { top_p: options.top_p }),
        ...(options.top_k !== undefined && { top_k: options.top_k }),
        ...(options.stop_sequences && { stop_sequences: options.stop_sequences }),
        ...(options.thinking && { thinking: options.thinking }),
      });
      
      // Capture token usage
      if (resp.usage) {
        lastUsage = {
          inputTokens: resp.usage.input_tokens,
          outputTokens: resp.usage.output_tokens,
          totalTokens: (resp.usage.input_tokens || 0) + (resp.usage.output_tokens || 0)
        };
      }
      
      const text = resp?.content?.[0]?.text ?? resp?.content ?? "";
      return typeof text === "string" ? text : JSON.stringify(text);
    },
    async genWithTools(prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> {
      const { nameMap, formattedTools } = createOpenAICompatibleTools(tools);

      // Use the OpenAI-compatible shim that handles tools properly
      const resp = await (client as any).chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: formattedTools,
        tool_choice: "auto",
      });

      // Capture token usage (from OpenAI-compatible shim)
      if (resp.usage) {
        lastUsage = {
          inputTokens: resp.usage.prompt_tokens || resp.usage.input_tokens,
          outputTokens: resp.usage.completion_tokens || resp.usage.output_tokens,
          totalTokens: resp.usage.total_tokens
        };
      }

      const message = resp.choices?.[0]?.message;
      const result = parseOpenAICompatibleResponse(message, nameMap);
      result.usage = lastUsage || undefined;
      return result;
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      // Native streaming using messages.create with stream: true
      const streamResp: any = await (client as any).messages.create({ 
        model, 
        max_tokens: options.max_tokens || 256, 
        messages: [{ role: "user", content: prompt }], 
        stream: true,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.top_p !== undefined && { top_p: options.top_p }),
        ...(options.top_k !== undefined && { top_k: options.top_k }),
        ...(options.stop_sequences && { stop_sequences: options.stop_sequences }),
        ...(options.thinking && { thinking: options.thinking }),
      });
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
    getUsage: () => lastUsage
  };
}


