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
export function mcp(url: string): MCPHandle {
  const u = new URL(url);
  const host = (u.hostname || 'host').replace(/[^a-zA-Z0-9_-]/g, '_');
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  const path = (u.pathname || '/').replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
  const id = `${host}_${port}${path}`.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return { id, url };
}

async function withMCP<T>(h: MCPHandle, fn: (c: MCPClient) => Promise<T>): Promise<T> {
  const client = new MCPClient({ name: "volcano-sdk", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(h.url));
  await client.connect(transport);
  try { return await fn(client); }
  finally { await client.close(); }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Step'): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
export type RetryConfig = {
  delay?: number;      // seconds to wait before each retry (mutually exclusive with backoff)
  backoff?: number;    // exponential factor, waits 1s, factor^n each retry
  retries?: number;    // total attempts including the first one; default 3
};

export type Step =
  | { prompt: string; llm?: LLMHandle; instructions?: string; timeout?: number; retry?: RetryConfig }
  | { mcp: MCPHandle; tool: string; args?: Record<string, any>; timeout?: number; retry?: RetryConfig }
  | { prompt: string; llm?: LLMHandle; mcp: MCPHandle; tool: string; args?: Record<string, any>; instructions?: string; timeout?: number; retry?: RetryConfig }
  | { prompt: string; llm?: LLMHandle; mcps: MCPHandle[]; instructions?: string; timeout?: number; retry?: RetryConfig };

export type StepResult = {
  prompt?: string;
  llmOutput?: string;
  mcp?: { endpoint: string; tool: string; result: any };
  toolCalls?: Array<{ name: string; endpoint: string; result: any }>;
};

type StepFactory = (history: StepResult[]) => Step;

function buildHistoryContext(history: StepResult[]): string {
  if (history.length === 0) return '';
  const last = history[history.length - 1];
  const parts: string[] = [];
  if (last.llmOutput) {
    parts.push(`Previous LLM answer:\n${last.llmOutput}`);
  }
  if (last.toolCalls && last.toolCalls.length > 0) {
    const topTools = last.toolCalls.slice(-3).map(t => `- ${t.name} -> ${typeof t.result === 'string' ? t.result : JSON.stringify(t.result)}`);
    parts.push(`Previous tool results:\n${topTools.join('\n')}`);
  }
  return parts.length ? `\n\n[Context from previous steps]\n${parts.join('\n')}` : '';
}

type AgentOptions = { llm?: LLMHandle; instructions?: string; timeout?: number; retry?: RetryConfig };

export function agent(opts?: AgentOptions) {
  const steps: Array<Step | StepFactory | { __reset: true }> = [];
  const defaultLlm = opts?.llm;
  let contextHistory: StepResult[] = [];
  const globalInstructions = opts?.instructions;
  const defaultTimeoutMs = ((typeof opts?.timeout === 'number' ? opts!.timeout! : 60)) * 1000; // seconds -> ms
  const defaultRetry: RetryConfig = opts?.retry ?? { delay: 0, retries: 3 };
  return {
    resetHistory() { steps.push({ __reset: true }); return this; },
    then(s: Step | StepFactory) { steps.push(s); return this; },
    async run(log?: (s: StepResult) => void): Promise<StepResult[]> {
      const out: StepResult[] = [];
      for (const raw of steps) {
        if ((raw as any).__reset) { contextHistory = []; continue; }
        const s = typeof raw === 'function' ? (raw as StepFactory)(out) : (raw as Step);
        const stepTimeoutMs = (s as any).timeout != null ? (s as any).timeout * 1000 : defaultTimeoutMs; // seconds -> ms
        const retryCfg: RetryConfig = (s as any).retry ?? defaultRetry;
        const attemptsTotal = typeof retryCfg.retries === 'number' && retryCfg.retries! > 0 ? retryCfg.retries! : (defaultRetry.retries ?? 3);
        const useDelay = typeof retryCfg.delay === 'number' ? retryCfg.delay! : (defaultRetry.delay ?? 0);
        const useBackoff = retryCfg.backoff;
        if (useDelay && useBackoff) throw new Error('retry: specify either delay or backoff, not both');

        const doStep = async (): Promise<StepResult> => {
          const r: StepResult = {};
          
          // Automatic tool selection with iterative tool calls
          if ("mcps" in s && "prompt" in s) {
            const usedLlm = (s as any).llm ?? defaultLlm;
            if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
            const stepInstructions = (s as any).instructions ?? globalInstructions;
            const promptWithHistory = (s as any).prompt + buildHistoryContext(contextHistory);
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

              const messages: any[] = [];
              if (stepInstructions) messages.push({ role: 'system', content: stepInstructions });
              messages.push({ role: "user", content: promptWithHistory });
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
            if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
            const stepInstructions = (s as any).instructions ?? globalInstructions;
            const promptWithHistory = (s as any).prompt + buildHistoryContext(contextHistory);
            const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
            r.prompt = (s as any).prompt;
            r.llmOutput = await usedLlm.gen(finalPrompt);
          }
          // Explicit MCP tool calls (existing behavior)
          else if ("mcp" in s && "tool" in s) {
            if ("prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const promptWithHistory = (s as any).prompt + buildHistoryContext(contextHistory);
              const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
              r.prompt = (s as any).prompt;
              r.llmOutput = await usedLlm.gen(finalPrompt);
            }
            const res = await withMCP((s as any).mcp, (c) => c.callTool({ name: (s as any).tool, arguments: (s as any).args ?? {} }));
            r.mcp = { endpoint: (s as any).mcp.url, tool: (s as any).tool, result: res };
          }

          return r;
        };

        // Retry loop with per-attempt timeout
        let lastError: any;
        let result: StepResult | undefined;
        for (let attempt = 1; attempt <= attemptsTotal; attempt++) {
          try {
            const r = await withTimeout(doStep(), stepTimeoutMs, 'Step');
            result = r;
            break;
          } catch (e) {
            lastError = e;
            if (attempt >= attemptsTotal) break;
            // schedule wait according to policy
            if (typeof useBackoff === 'number' && useBackoff > 0) {
              const baseMs = 1000; // start at 1s
              const waitMs = baseMs * Math.pow(useBackoff, attempt - 1);
              await sleep(waitMs);
            } else {
              const waitMs = Math.max(0, (useDelay ?? 0) * 1000);
              if (waitMs > 0) await sleep(waitMs);
            }
          }
        }
        if (!result) throw lastError;

        const r = result;
        log?.(r);
        out.push(r);
        contextHistory.push(r);
      }
      return out;
    },
  };
}
