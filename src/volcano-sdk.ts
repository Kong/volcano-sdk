// src/volcano-sdk.ts
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { llmOpenAI as llmOpenAIProvider } from "./llms/openai.js";
import type { LLMConfig, LLMHandle, ToolDefinition, LLMToolResult } from "./llms/types.js";

/* ---------- LLM ---------- */
export type { LLMConfig, LLMHandle, ToolDefinition, LLMToolResult };
export const llmOpenAI = llmOpenAIProvider;

/* ---------- MCP (Streamable HTTP) ---------- */
export type MCPHandle = { id: string; url: string };
export function mcp(id: string, url: string): MCPHandle { return { id, url }; }

async function withMCP<T>(h: MCPHandle, fn: (c: MCPClient) => Promise<T>): Promise<T> {
  const client = new MCPClient({ name: "volcano-sdk", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(h.url));
  await client.connect(transport);                // <-- pass transport here
  try { return await fn(client); }
  finally { await client.close(); }
}

// Tool discovery for automatic selection
export async function discoverTools(handles: MCPHandle[]): Promise<ToolDefinition[]> {
  const allTools: ToolDefinition[] = [];
  
  for (const handle of handles) {
    try {
      const tools = await withMCP(handle, async (client) => {
        const result = await client.listTools();
        return result.tools.map(tool => ({
          name: `${handle.id}.${tool.name}`,
          description: tool.description || `Tool: ${tool.name}`,
          parameters: tool.inputSchema || { type: "object", properties: {} },
          mcpHandle: handle,
        }));
      });
      allTools.push(...tools);
    } catch (error) {
      console.warn(`Failed to discover tools from ${handle.id}:`, error);
    }
  }
  
  return allTools;
}

/* ---------- Agent chain ---------- */
export type Step =
  | { prompt: string; llm: LLMHandle }
  | { mcp: MCPHandle; tool: string; args?: Record<string, any> }
  | { prompt: string; llm: LLMHandle; mcp: MCPHandle; tool: string; args?: Record<string, any> }
  | { prompt: string; llm: LLMHandle; mcps: MCPHandle[] }; // New: automatic tool selection

export type StepResult = {
  prompt?: string;
  llmOutput?: string;
  mcp?: { endpoint: string; tool: string; result: any };
  toolCalls?: Array<{ name: string; endpoint: string; result: any }>; // New: for multiple tool calls
};

export function agent() {
  const steps: Step[] = [];
  return {
    then(s: Step) { steps.push(s); return this; },
    async run(log?: (s: StepResult) => void): Promise<StepResult[]> {
      const out: StepResult[] = [];
      for (const s of steps) {
        const r: StepResult = {};
        
        // Handle automatic tool selection with iterative tool calls
        if ("mcps" in s) {
          r.prompt = s.prompt;
          const availableTools = await discoverTools(s.mcps);
          if (availableTools.length === 0) {
            r.llmOutput = "No tools available for this request.";
          } else {
            const client = s.llm.client as any;
            const model = s.llm.model;
            // Build tool mapping and OpenAI tool schema
            const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
            const openaiTools = availableTools.map((tool) => {
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

            const messages: any[] = [{ role: "user", content: s.prompt }];
            const aggregated: Array<{ name: string; endpoint: string; result: any }> = [];
            const maxIterations = 4;
            for (let i = 0; i < maxIterations; i++) {
              const resp = await client.chat.completions.create({
                model,
                messages,
                tools: openaiTools,
                tool_choice: "auto",
              });
              const msg: any = resp.choices?.[0]?.message as any;
              r.llmOutput = msg?.content || r.llmOutput;
              const toolCalls: any[] = (msg?.tool_calls ?? []) as any[];
              if (!toolCalls.length) break;

              // Push the assistant message that contains tool_calls before adding tool results
              messages.push(msg);

              const toolMessages: any[] = [];
              for (const call of toolCalls) {
                const sanitized = call?.function?.name ?? call?.name ?? "";
                const mapped = nameMap.get(sanitized);
                const argsJson: string = call?.function?.arguments ?? call?.arguments ?? "{}";
                const args = (() => { try { return JSON.parse(argsJson); } catch { return {}; } })();
                const handle = mapped?.def.mcpHandle;
                if (!handle) continue;
                // Compute actual tool name (strip handle prefix)
                const idx = (mapped?.dottedName || sanitized).indexOf('.');
                const actualToolName = idx >= 0 ? (mapped?.dottedName || sanitized).slice(idx + 1) : (mapped?.dottedName || sanitized);
                const result = await withMCP(handle, (c) => c.callTool({ name: actualToolName, arguments: args }));
                aggregated.push({ name: mapped?.dottedName || sanitized, endpoint: handle.url, result });
                // Provide tool result back to LLM, tied to the specific tool_call id
                toolMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
              }
              if (!toolMessages.length) break;
              messages.push(...toolMessages);
            }
            if (aggregated.length) r.toolCalls = aggregated;
          }
        }
        // Handle explicit LLM-only steps
        else if ("prompt" in s && !("mcp" in s)) {
          r.prompt = s.prompt;
          r.llmOutput = await s.llm.gen(s.prompt);
        }
        // Handle explicit MCP tool calls (existing behavior)
        else if ("mcp" in s && "tool" in s) {
          if ("prompt" in s) {
            r.prompt = s.prompt;
            r.llmOutput = await s.llm.gen(s.prompt);
          }
          const res = await withMCP(s.mcp, (c) =>
            c.callTool({ name: s.tool, arguments: s.args ?? {} })
          );
          r.mcp = { endpoint: s.mcp.url, tool: s.tool, result: res };
        }
        
        log?.(r);
        out.push(r);
      }
      return out;
    },
  };
}
