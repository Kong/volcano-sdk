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
  | { prompt: string; llm?: LLMHandle }
  | { mcp: MCPHandle; tool: string; args?: Record<string, any> }
  | { prompt: string; llm?: LLMHandle; mcp: MCPHandle; tool: string; args?: Record<string, any> }
  | { prompt: string; llm?: LLMHandle; mcps: MCPHandle[] };

export type StepResult = {
  prompt?: string;
  llmOutput?: string;
  mcp?: { endpoint: string; tool: string; result: any };
  toolCalls?: Array<{ name: string; endpoint: string; result: any }>;
};

export function agent() {
  const steps: Step[] = [];
  let defaultLlm: LLMHandle | undefined;
  return {
    llm(h: LLMHandle) { defaultLlm = h; return this; },
    then(s: Step) { steps.push(s); return this; },
    async run(log?: (s: StepResult) => void): Promise<StepResult[]> {
      const out: StepResult[] = [];
      for (const s of steps) {
        const r: StepResult = {};
        
        // Automatic tool selection with iterative tool calls
        if ("mcps" in s && "prompt" in s) {
          const usedLlm = (s as any).llm ?? defaultLlm;
          if (!usedLlm) throw new Error("No LLM provided. Set a default with agent().llm(...) or specify per-step.");
          r.prompt = (s as any).prompt;
          const availableTools = await discoverTools((s as any).mcps);
          if (availableTools.length === 0) {
            r.llmOutput = "No tools available for this request.";
          } else {
            const client = usedLlm.client as any;
            const model = usedLlm.model;
            const nameMap = new Map<string, { dottedName: string; def: ToolDefinition }>();
            const openaiTools = availableTools.map((tool) => {
              const dottedName = tool.name;
              const sanitized = dottedName.replace(/[^a-zA-Z0-9_-]/g, "_");
              nameMap.set(sanitized, { dottedName, def: tool });
              return { type: "function" as const, function: { name: sanitized, description: tool.description, parameters: tool.parameters } };
            });

            const messages: any[] = [{ role: "user", content: (s as any).prompt }];
            const aggregated: Array<{ name: string; endpoint: string; result: any }> = [];
            const maxIterations = 4;
            for (let i = 0; i < maxIterations; i++) {
              const resp = await client.chat.completions.create({ model, messages, tools: openaiTools, tool_choice: "auto" });
              const msg: any = resp.choices?.[0]?.message as any;
              r.llmOutput = msg?.content || r.llmOutput;
              const toolCalls: any[] = (msg?.tool_calls ?? []) as any[];
              if (!toolCalls.length) break;
              messages.push(msg);
              const toolMessages: any[] = [];
              for (const call of toolCalls) {
                const sanitized = call?.function?.name ?? call?.name ?? "";
                const mapped = nameMap.get(sanitized);
                const argsJson: string = call?.function?.arguments ?? call?.arguments ?? "{}";
                const args = (() => { try { return JSON.parse(argsJson); } catch { return {}; } })();
                const handle = mapped?.def.mcpHandle;
                if (!handle) continue;
                const idx = (mapped?.dottedName || sanitized).indexOf('.');
                const actualToolName = idx >= 0 ? (mapped?.dottedName || sanitized).slice(idx + 1) : (mapped?.dottedName || sanitized);
                const result = await withMCP(handle, (c) => c.callTool({ name: actualToolName, arguments: args }));
                aggregated.push({ name: mapped?.dottedName || sanitized, endpoint: handle.url, result });
                toolMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
              }
              if (!toolMessages.length) break;
              messages.push(...toolMessages);
            }
            if (aggregated.length) r.toolCalls = aggregated;
          }
        }
        // LLM-only steps
        else if ("prompt" in s && !("mcp" in s) && !("mcps" in s)) {
          const usedLlm = (s as any).llm ?? defaultLlm;
          if (!usedLlm) throw new Error("No LLM provided. Set a default with agent().llm(...) or specify per-step.");
          r.prompt = (s as any).prompt;
          r.llmOutput = await usedLlm.gen((s as any).prompt);
        }
        // Explicit MCP tool calls (existing behavior)
        else if ("mcp" in s && "tool" in s) {
          if ("prompt" in s) {
            const usedLlm = (s as any).llm ?? defaultLlm;
            if (!usedLlm) throw new Error("No LLM provided. Set a default with agent().llm(...) or specify per-step.");
            r.prompt = (s as any).prompt;
            r.llmOutput = await usedLlm.gen((s as any).prompt);
          }
          const res = await withMCP((s as any).mcp, (c) => c.callTool({ name: (s as any).tool, arguments: (s as any).args ?? {} }));
          r.mcp = { endpoint: (s as any).mcp.url, tool: (s as any).tool, result: res };
        }
        
        log?.(r);
        out.push(r);
      }
      return out;
    },
  };
}
