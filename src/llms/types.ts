export type LLMConfig = { provider: "openai"; apiKey: string; model?: string; baseURL?: string };

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, any>;
  mcpHandle?: import("../volcano-sdk").MCPHandle;
};

export type LLMToolResult = {
  content?: string;
  toolCalls: Array<{
    name: string; // dotted name: <handleId>.<toolName>
    arguments: Record<string, any>;
    mcpHandle?: import("../volcano-sdk").MCPHandle;
  }>;
};

export type LLMHandle = {
  id: string;
  gen: (prompt: string) => Promise<string>;
  genWithTools: (prompt: string, tools: ToolDefinition[]) => Promise<LLMToolResult>;
  client: any; // provider-specific client (e.g., OpenAI)
  model: string;
};
