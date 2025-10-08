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

export type JSONSchema = {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: any;
};

export type OpenAIResponsesOptions = Omit<OpenAIOptions, 'response_format'> & {
  // Structured outputs with JSON schema (available in gpt-4o-mini, gpt-4o, o1, etc.)
  jsonSchema: {
    name: string;
    description?: string;
    schema: JSONSchema;
    strict?: boolean;
  };
};

export type OpenAIResponsesConfig = {
  apiKey: string;
  model: string; // Required - models that support structured outputs (gpt-4o-mini, gpt-4o, o1, o3, etc.)
  baseURL?: string;
  options?: OpenAIResponsesOptions;
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

/**
 * OpenAI LLM with Structured Outputs (JSON Schema validation)
 * Uses Chat Completions API with response_format set to json_schema mode.
 * Guarantees the model's output matches your JSON schema.
 * 
 * Supported models: gpt-4o-mini, gpt-4o, gpt-4o-2024-08-06 and later, o1, o3
 */
export function llmOpenAIResponses(cfg: OpenAIResponsesConfig): LLMHandle {
  if (!cfg.model) {
    throw new Error(
      "llmOpenAIResponses: Missing required 'model' parameter. " +
      "Please specify which OpenAI model to use. " +
      "Supported: gpt-4o-mini, gpt-4o, o1-mini, o1-preview, o3-mini. " +
      "Example: llmOpenAIResponses({ apiKey: 'sk-...', model: 'gpt-4o-mini', options: { jsonSchema: {...} } })"
    );
  }
  
  if (!cfg.options?.jsonSchema) {
    throw new Error(
      "llmOpenAIResponses: Missing required 'jsonSchema' in options. " +
      "Structured outputs require a JSON schema. " +
      "Example: options: { jsonSchema: { name: 'response', schema: { type: 'object', properties: {...} } } }"
    );
  }
  
  const model = cfg.model;
  const id = `OpenAI-Responses-${model}`;
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const { jsonSchema, ...otherOptions } = cfg.options;
  
  // Build response_format with json_schema mode
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: jsonSchema.name,
      description: jsonSchema.description,
      schema: jsonSchema.schema,
      strict: jsonSchema.strict ?? true  // Default to strict mode
    }
  };

  return {
    id,
    client,
    model,
    gen: async (prompt: string) => {
      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: responseFormat,
        ...otherOptions,
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
        response_format: responseFormat,
        ...otherOptions,
      });

      const message = r.choices?.[0]?.message;
      return parseOpenAICompatibleResponse(message, nameMap);
    },
    genStream: async function* (prompt: string) {
      const stream = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        response_format: responseFormat,
        ...otherOptions,
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
