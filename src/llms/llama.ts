import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types.js";
import { createOpenAICompatibleTools, parseOpenAICompatibleResponse } from "./utils.js";

type OpenAILikeClient = {
  chat: { completions: { create: (args: any) => Promise<any> } };
};

export type LlamaOptions = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop?: string | string[];
  repeat_penalty?: number;
  seed?: number;
  num_predict?: number; // Ollama-specific
};

export type LlamaConfig = {
  model: string; // Required - be explicit about which model to use
  client?: OpenAILikeClient; // e.g., local OpenAI-compatible server (Ollama/OpenRouter/etc.)
  apiKey?: string;           // optional; if provided, we use fetch with Authorization: Bearer
  baseURL?: string;          // optional; default http://localhost:11434 or provider endpoint
  options?: LlamaOptions;
  timeout?: number;          // optional; request timeout in milliseconds (default: 60000ms / 60s)
};

export function llmLlama(cfg: LlamaConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error(
      "llmLlama: Missing required 'model' parameter. " +
      "Please specify which Llama model to use. " +
      "Example: llmLlama({ baseURL: 'http://localhost:11434', model: 'llama3.2:3b' })"
    );
  }
  const model = cfg.model;
  const options = cfg.options || {};
  const timeout = cfg.timeout ?? 60000; // Default 60 second timeout
  let lastUsage: import('./types').TokenUsage | null = null;
  let client = cfg.client;

  if (!client && (cfg.apiKey || cfg.baseURL)) {
    const base = (cfg.baseURL || "http://localhost:11434").replace(/\/$/, "");
    const apiKey = cfg.apiKey;
    client = {
      chat: {
        completions: {
          create: async (params) => {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            try {
              const res = await fetch(`${base}/v1/chat/completions`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                },
                body: JSON.stringify(params),
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (!res.ok) {
                const text = await res.text();
                const err: any = new Error(`Llama HTTP ${res.status}`);
                err.status = res.status;
                err.body = text;
                throw err;
              }
              
              // Handle streaming responses
              if (params.stream) {
                return res; // Return the response object for streaming
              }
              
              return await res.json();
            } catch (err: any) {
              clearTimeout(timeoutId);
              
              // Provide helpful error message for timeout
              if (err.name === 'AbortError') {
                throw new Error(
                  `Llama request timed out after ${timeout}ms. ` +
                  `The model may be slow to respond or the server may be unresponsive. ` +
                  `Consider increasing the timeout: llmLlama({ ..., timeout: 120000 })`
                );
              }
              
              throw err;
            }
          },
        },
      },
    } as OpenAILikeClient;
  }

  if (!client) {
    throw new Error(
      "llmLlama: Missing configuration. " +
      "Please provide either 'client' or 'baseURL' for an OpenAI-compatible endpoint (e.g., Ollama). " +
      "Example: llmLlama({ baseURL: 'http://localhost:11434', model: 'llama3.2:3b' })"
    );
  }

  return {
    id: `Llama-${model}`,
    model,
    client,
    async gen(prompt: string): Promise<string> {
      const resp = await client!.chat.completions.create({ 
        model, 
        messages: [{ role: "user", content: prompt }],
        ...options,
      });
      
      // Capture token usage (OpenAI-compatible)
      if (resp.usage) {
        lastUsage = {
          inputTokens: resp.usage.prompt_tokens,
          outputTokens: resp.usage.completion_tokens,
          totalTokens: resp.usage.total_tokens
        };
      }
      
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
      
      // Capture token usage (OpenAI-compatible)
      if (resp.usage) {
        lastUsage = {
          inputTokens: resp.usage.prompt_tokens,
          outputTokens: resp.usage.completion_tokens,
          totalTokens: resp.usage.total_tokens
        };
      }
      
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
      throw new Error('No response body received from Llama streaming endpoint');
    },
    getUsage: () => lastUsage
  };
}


