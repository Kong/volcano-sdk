import OpenAI from "openai";
import { LLMHandle, LLMToolResult, ToolDefinition } from "./types";
import {
  createOpenAICompatibleTools,
  parseOpenAICompatibleResponse,
} from "./utils.js";

export type CohereAIOptions = {
  temperature?: number;
  max_tokens?: number;
  stop_sequences?: string[];
  seed?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  k?: number;
  p?: number;
};

export type CohereConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  options?: CohereAIOptions;
};

export function llmCohere(cfg: CohereConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error(
      "llmCohere: Missing required 'model' parameter. " +
        "Please specify which Cohere model to use. " +
        "Example: llmCohere({ apiKey: '<YOUR-API-KEY>', model: 'command-a-03-2025' }"
    );
  }
  const model = cfg.model;
  const id = `Cohere-${model}`;
  if (cfg.baseUrl === undefined) {
    // To use OpenAI Compatibility API
    // see: https://docs.cohere.com/reference/chat
    cfg.baseUrl = "https://api.cohere.ai/compatibility/v1";
  }
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });
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
    },
  };
}
