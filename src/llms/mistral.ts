import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";
import { createOpenAICompatibleTools, parseOpenAICompatibleResponse, mergeHeaders } from "./utils.js";

type OpenAILikeClient = {
  chat: { completions: { create: (args: any) => Promise<any> } };
};

export type MistralOptions = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  safe_prompt?: boolean;
  random_seed?: number;
  response_format?: { type: "json_object" | "text" };
};

export type MistralConfig = {
  model: string; // Required - be explicit about which model to use
  client?: OpenAILikeClient;
  apiKey?: string;
  baseURL?: string; // default https://api.mistral.ai
  defaultHeaders?: Record<string, string>; // Custom headers to include in all requests
  options?: MistralOptions;
};

export function llmMistral(cfg: MistralConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error(
      "llmMistral: Missing required 'model' parameter. " +
      "Please specify which Mistral model to use. " +
      "Example: llmMistral({ apiKey: 'your-key', model: 'mistral-small-latest' })"
    );
  }
  const model = cfg.model;
  const options = cfg.options || {};
  const defaultHeaders = cfg.defaultHeaders;
  let client = cfg.client;

  if (!client && (cfg.apiKey || cfg.baseURL)) {
    const base = (cfg.baseURL || "https://api.mistral.ai").replace(/\/$/, "");
    const apiKey = cfg.apiKey;
    client = {
      chat: {
        completions: {
          create: async (params) => {
            const res = await fetch(`${base}/v1/chat/completions`, {
              method: "POST",
              headers: mergeHeaders(
                {
                  "content-type": "application/json",
                  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                },
                defaultHeaders
              ),
              body: JSON.stringify(params),
            });
            if (!res.ok) {
              const text = await res.text();
              const err: any = new Error(`Mistral HTTP ${res.status}`);
              err.status = res.status;
              err.body = text;
              throw err;
            }
            
            // Handle streaming responses
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
      "llmMistral: Missing configuration. " +
      "Please provide either 'client' or 'apiKey' for Mistral API. " +
      "Example: llmMistral({ apiKey: 'your-key', model: 'mistral-small-latest' })"
    );
  }

  return {
    id: `Mistral-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const resp = await client!.chat.completions.create({ 
        model, 
        messages: [{ role: "user", content: prompt }],
        ...options,
      });
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
      
      const message = resp?.choices?.[0]?.message;
      return parseOpenAICompatibleResponse(message, nameMap);
    },
    async *genStream(prompt: string): AsyncGenerator<string, void, unknown> {
      const streamResponse: any = await client!.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        ...options,
      });
      
      // Handle Server-Sent Events streaming
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
      throw new Error('No response body received from Mistral streaming endpoint');
    },
  };
}


