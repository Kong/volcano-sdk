import type { ToolDefinition, LLMToolResult } from "./types.js";

/**
 * Sanitize tool names to only include alphanumeric characters, underscores, and hyphens.
 * This ensures compatibility across different LLM providers.
 */
export function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Safely parse JSON arguments from tool calls.
 * Returns an empty object if parsing fails.
 */
export function parseToolArguments(argsJson: string): Record<string, any> {
  try {
    return JSON.parse(argsJson);
  } catch {
    return {};
  }
}

/**
 * Type definitions for OpenAI-compatible tool call responses
 */
export interface OpenAICompatibleToolCall {
  function?: {
    name: string;
    arguments: string;
  };
  name?: string;
  arguments?: string;
}

export interface OpenAICompatibleMessage {
  content?: string | null;
  tool_calls?: OpenAICompatibleToolCall[];
}

/**
 * Create tool mapping for OpenAI-compatible providers.
 * Handles name sanitization and creates a reverse lookup map.
 */
export function createOpenAICompatibleTools(tools: ToolDefinition[]) {
  const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
  const formattedTools = tools.map((tool) => {
    const dottedName = tool.name;
    const sanitized = sanitizeToolName(dottedName);
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

  return { nameMap, formattedTools };
}

/**
 * Parse OpenAI-compatible tool call response into LLMToolResult format.
 */
export function parseOpenAICompatibleResponse(
  message: any,
  nameMap: Map<string, { dottedName: string; def: ToolDefinition }>
): LLMToolResult {
  const rawCalls = message?.tool_calls ?? [];
  const toolCalls = rawCalls.map((call: any) => {
    const sanitizedName = call?.function?.name ?? call?.name ?? "";
    const mapped = nameMap.get(sanitizedName);
    const argsJson = call?.function?.arguments ?? call?.arguments ?? "{}";
    const parsedArgs = parseToolArguments(argsJson);
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
}
