import OpenAI from "openai";
import type { LLMHandle, LLMToolResult, ToolDefinition } from "./types";
import { createOpenAICompatibleTools, parseOpenAICompatibleResponse } from "./utils.js";

export type OpenAIOptions = {
  temperature?: number;
  max_tokens?: number; // Legacy parameter, use max_completion_tokens for newer models
  max_completion_tokens?: number; // Preferred for newer models (gpt-4o, gpt-4o-mini, etc.)
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  seed?: number;
  response_format?: { type: "json_object" | "text" };
  n?: number;
  logit_bias?: Record<string, number>;
  user?: string;
};

export type OpenAIConfig = { 
  apiKey: string; 
  model: string; // Required - be explicit about which model to use
  baseURL?: string;
  options?: OpenAIOptions;
};

export function llmOpenAI(cfg: OpenAIConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error(
      "llmOpenAI: Missing required 'model' parameter. " +
      "Please specify which OpenAI model to use. " +
      "Example: llmOpenAI({ apiKey: 'sk-...', model: 'gpt-5-mini' })"
    );
  }
  const model = cfg.model;
  const id = `OpenAI-${model}`;
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const options = cfg.options || {};

  return {
    id,
    client,
    model,
    gen: async (prompt: string) => {
      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        ...options,
      });
      return r.choices?.[0]?.message?.content ?? "";
    },
    genWithTools: async (prompt: string, tools: ToolDefinition[]): Promise<LLMToolResult> => {
      const { nameMap, formattedTools } = createOpenAICompatibleTools(tools);

      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        tools: formattedTools,
        tool_choice: "auto",
        ...options,
      });

      const message = r.choices?.[0]?.message;
      return parseOpenAICompatibleResponse(message, nameMap);
    },
    genStream: async function* (prompt: string) {
      const stream = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        ...options,
      });
      for await (const chunk of stream as any) {
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield delta;
        }
      }
    }
  };
}
