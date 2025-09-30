// src/volcano-sdk.ts
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { llmOpenAI as llmOpenAIProvider } from "./llms/openai.js";
import { executeParallel, executeBranch, executeSwitch, executeWhile, executeForEach, executeRetryUntil, executeRunAgent } from "./patterns.js";
export { llmAnthropic } from "./llms/anthropic.js";
export { llmLlama } from "./llms/llama.js";
export { llmMistral } from "./llms/mistral.js";
export { llmBedrock } from "./llms/bedrock.js";
export { llmVertexStudio } from "./llms/vertex-studio.js";
export { llmAzure } from "./llms/azure.js";
export type { OpenAIConfig, OpenAIOptions } from "./llms/openai.js";
export type { AnthropicConfig, AnthropicOptions } from "./llms/anthropic.js";
export type { LlamaConfig, LlamaOptions } from "./llms/llama.js";
export type { MistralConfig, MistralOptions } from "./llms/mistral.js";
export type { BedrockConfig, BedrockOptions } from "./llms/bedrock.js";
export type { VertexStudioConfig, VertexStudioOptions } from "./llms/vertex-studio.js";
export type { AzureConfig, AzureOptions } from "./llms/azure.js";
import type { LLMHandle, ToolDefinition, LLMToolResult } from "./llms/types.js";
import Ajv from "ajv";

/* ---------- LLM ---------- */
export type { LLMHandle, ToolDefinition, LLMToolResult };
export const llmOpenAI = llmOpenAIProvider;

/* ---------- Errors ---------- */
export interface VolcanoErrorMeta {
  stepId?: number;
  provider?: string;
  requestId?: string;
  retryable?: boolean;
}

export class VolcanoError extends Error {
  meta: VolcanoErrorMeta;
  constructor(message: string, meta: VolcanoErrorMeta = {}, options?: { cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    this.meta = meta;
    if (options?.cause) (this as any).cause = options.cause;
  }
}
export class AgentConcurrencyError extends VolcanoError {}
export class TimeoutError extends VolcanoError {}
export class ValidationError extends VolcanoError {}
export class RetryExhaustedError extends VolcanoError {}
export class LLMError extends VolcanoError {}
export class MCPError extends VolcanoError {}
export class MCPConnectionError extends MCPError {}
export class MCPToolError extends MCPError {}

function isRetryableStatus(status?: number): boolean {
  if (!status && status !== 0) return false;
  return status >= 500 || status === 429 || status === 408;
}
function classifyProviderFromLlm(usedLlm?: LLMHandle): string | undefined {
  if (!usedLlm) return undefined;
  if ((usedLlm as any).id) return `llm:${(usedLlm as any).id}`;
  return `llm:${usedLlm.model}`;
}
function classifyProviderFromMcp(handle?: MCPHandle): string | undefined {
  if (!handle) return undefined;
  try { const u = new URL(handle.url); return `mcp:${u.host}`; } catch { return `mcp:${handle.id}`; }
}
function normalizeError(e: any, kind: 'timeout'|'validation'|'llm'|'mcp-conn'|'mcp-tool'|'retry', meta: VolcanoErrorMeta): VolcanoError {
  if (kind === 'timeout') return new TimeoutError(e?.message || 'Step timed out', { ...meta, retryable: true }, { cause: e });
  if (kind === 'validation') return new ValidationError(e?.message || 'Validation failed', { ...meta, retryable: false }, { cause: e });
  if (kind === 'retry') return new RetryExhaustedError(e?.message || 'Retry attempts exhausted', { ...meta }, { cause: e });
  if (kind === 'llm') {
    const status = e?.status ?? e?.response?.status;
    const requestId = e?.response?.headers?.get?.('x-request-id') || e?.id || e?.response?.data?.id;
    const retryable = (status == null ? true : isRetryableStatus(status)) || !!e?.code?.toString?.()?.includes?.('ECONN') || !!e?.code?.toString?.()?.includes?.('ETIMEDOUT');
    return new LLMError(e?.message || 'LLM error', { ...meta, requestId, retryable }, { cause: e });
  }
  if (kind === 'mcp-conn') {
    const retryable = true;
    return new MCPConnectionError(e?.message || 'MCP connection error', { ...meta, retryable }, { cause: e });
  }
  // mcp-tool
  return new MCPToolError(e?.message || 'MCP tool error', { ...meta, retryable: false }, { cause: e });
}

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

// Ajv validator instance
const ajv = new Ajv({ allErrors: true, strict: false });
const VALIDATOR_CACHE = new WeakMap<object, any>();
function validateWithSchema(schema: any | undefined, args: any, context: string) {
  if (!schema || typeof schema !== 'object') return; // nothing to validate
  let validate = VALIDATOR_CACHE.get(schema);
  if (!validate) {
    validate = ajv.compile(schema as any);
    VALIDATOR_CACHE.set(schema, validate);
  }
  const ok = validate(args);
  if (!ok) {
    const msg = (validate.errors || []).map((e: any) => `${e.instancePath || e.schemaPath}: ${e.message}`).join('; ');
    throw new Error(`${context} arguments failed schema validation: ${msg}`);
  }
}
export function __internal_validateToolArgs(schema: any, args: any) { validateWithSchema(schema, args, 'test'); }

type MCPPoolEntry = {
  client: MCPClient;
  transport: StreamableHTTPClientTransport;
  lastUsed: number;
  busyCount: number;
};

const MCP_POOL = new Map<string, MCPPoolEntry>();
let MCP_POOL_MAX = 16;
let MCP_POOL_IDLE_MS = 30_000;

async function getPooledClient(url: string): Promise<MCPPoolEntry> {
  let entry = MCP_POOL.get(url);
  if (!entry) {
    // Evict LRU idle if over max
    if (MCP_POOL.size >= MCP_POOL_MAX) {
      const idleEntries = Array.from(MCP_POOL.entries()).filter(([, e]) => e.busyCount === 0);
      idleEntries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      const toEvict = idleEntries.slice(0, Math.max(0, MCP_POOL.size - MCP_POOL_MAX + 1));
      for (const [k, e] of toEvict) {
        try { await e.client.close(); } catch {}
        MCP_POOL.delete(k);
      }
    }
    const transport = new StreamableHTTPClientTransport(new URL(url));
    const client = new MCPClient({ name: "volcano-sdk", version: "0.0.1" });
    await client.connect(transport);
    entry = { client, transport, lastUsed: Date.now(), busyCount: 0 };
    MCP_POOL.set(url, entry);
  }
  entry.busyCount++;
  entry.lastUsed = Date.now();
  return entry;
}

async function releasePooledClient(url: string) {
  const entry = MCP_POOL.get(url);
  if (!entry) return;
  entry.busyCount = Math.max(0, entry.busyCount - 1);
  entry.lastUsed = Date.now();
}

async function cleanupIdlePool() {
  const now = Date.now();
  for (const [url, entry] of MCP_POOL) {
    if (entry.busyCount === 0 && now - entry.lastUsed > MCP_POOL_IDLE_MS) {
      try { await entry.client.close(); } catch {}
      MCP_POOL.delete(url);
    }
  }
}

// Periodic cleanup
let POOL_SWEEPER: any = undefined;
function ensurePoolSweeper() {
  if (!POOL_SWEEPER) {
    POOL_SWEEPER = setInterval(() => { cleanupIdlePool(); }, 5_000);
    // In tests or short-lived processes we don’t need to keep the event loop alive
    if (typeof POOL_SWEEPER.unref === 'function') POOL_SWEEPER.unref();
  }
}

// Internal test helpers
export function __internal_getMcpPoolStats() {
  return {
    size: MCP_POOL.size,
    entries: Array.from(MCP_POOL.entries()).map(([url, e]) => ({ url, busyCount: e.busyCount, lastUsed: e.lastUsed }))
  };
}
export async function __internal_forcePoolCleanup() { await cleanupIdlePool(); }
export function __internal_setPoolConfig(max: number, idleMs: number) { MCP_POOL_MAX = max; MCP_POOL_IDLE_MS = idleMs; }

async function withMCP<T>(h: MCPHandle, fn: (c: MCPClient) => Promise<T>): Promise<T> {
  ensurePoolSweeper();
  const entry = await getPooledClient(h.url);
  try { return await fn(entry.client); }
  finally { await releasePooledClient(h.url); }
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

// Tool discovery cache for automatic selection
const TOOL_CACHE = new Map<string, { tools: ToolDefinition[]; ts: number }>();
let TOOL_CACHE_TTL_MS = 60_000;

export async function discoverTools(handles: MCPHandle[]): Promise<ToolDefinition[]> {
  const allTools: ToolDefinition[] = [];
  
  for (const handle of handles) {
    try {
      const cached = TOOL_CACHE.get(handle.url);
      if (cached && (Date.now() - cached.ts) < TOOL_CACHE_TTL_MS) {
        // reuse cached with endpoint-specific names
        allTools.push(...cached.tools);
        continue;
      }
      const tools = await withMCP(handle, async (client) => {
        const result = await client.listTools();
        const mapped = result.tools.map(tool => ({
          name: `${handle.id}.${tool.name}`,
          description: tool.description || `Tool: ${tool.name}`,
          parameters: tool.inputSchema || { type: "object", properties: {} },
          mcpHandle: handle,
        }));
        TOOL_CACHE.set(handle.url, { tools: mapped, ts: Date.now() });
        return mapped;
      });
      allTools.push(...tools);
    } catch (error) {
      // Invalidate on failure
      TOOL_CACHE.delete(handle.url);
      console.warn(`Failed to discover tools from ${handle.id}:`, error);
    }
  }
  
  return allTools;
}

export function __internal_clearDiscoveryCache() { TOOL_CACHE.clear(); }
export function __internal_setDiscoveryTtl(ms: number) { TOOL_CACHE_TTL_MS = ms; }
export function __internal_primeDiscoveryCache(handle: MCPHandle, rawTools: Array<{ name: string; inputSchema?: any; description?: string }>) {
  const tools: ToolDefinition[] = rawTools.map(t => ({
    name: `${handle.id}.${t.name}`,
    description: t.description || `Tool: ${t.name}`,
    parameters: t.inputSchema || { type: 'object', properties: {} },
    mcpHandle: handle,
  }));
  TOOL_CACHE.set(handle.url, { tools, ts: Date.now() });
}

// helper to fetch tool schema for explicit calls
async function getToolSchema(handle: MCPHandle, toolName: string): Promise<any | undefined> {
  const cached = TOOL_CACHE.get(handle.url);
  if (cached) {
    const found = cached.tools.find(t => t.name === `${handle.id}.${toolName}`);
    return found?.parameters as any;
  }
  try {
    const tools = await withMCP(handle, async (client) => {
      const result = await client.listTools();
      const mapped = result.tools.map(tool => ({
        name: `${handle.id}.${tool.name}`,
        description: tool.description || `Tool: ${tool.name}`,
        parameters: tool.inputSchema || { type: 'object', properties: {} },
        mcpHandle: handle,
      }));
      TOOL_CACHE.set(handle.url, { tools: mapped, ts: Date.now() });
      return mapped;
    });
    const found = tools.find(t => t.name === `${handle.id}.${toolName}`);
    return found?.parameters as any;
  } catch {
    return undefined;
  }
}

/* ---------- Agent chain ---------- */
export type RetryConfig = {
  delay?: number;      // seconds to wait before each retry (mutually exclusive with backoff)
  backoff?: number;    // exponential factor, waits 1s, factor^n each retry
  retries?: number;    // total attempts including the first one; default 3
};

export type Step =
  | { prompt: string; llm?: LLMHandle; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void }
  | { mcp: MCPHandle; tool: string; args?: Record<string, any>; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void }
  | { prompt: string; llm?: LLMHandle; mcp: MCPHandle; tool: string; args?: Record<string, any>; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void }
  | { prompt: string; llm?: LLMHandle; mcps: MCPHandle[]; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void };

export type StepResult = {
  prompt?: string;
  llmOutput?: string;
  // Total wall time for this step (successful attempt) in milliseconds
  durationMs?: number;
  // Total LLM time spent during this step (sum across iterations) in milliseconds
  llmMs?: number;
  mcp?: { endpoint: string; tool: string; result: any; ms?: number };
  toolCalls?: Array<{ name: string; endpoint: string; result: any } & { ms?: number }>;
  // Parallel execution results (for parallel steps)
  parallel?: Record<string, StepResult>;
  parallelResults?: StepResult[];
  // Aggregated metrics (populated on the final step of a run)
  totalDurationMs?: number;
  totalLlmMs?: number;
  totalMcpMs?: number;
};

type StepFactory = (history: StepResult[]) => Step;

// Agent builder interface for type safety
export interface AgentBuilder {
  resetHistory(): AgentBuilder;
  then(s: Step | StepFactory): AgentBuilder;
<<<<<<< HEAD
  parallel(stepsOrDict: Step[] | Record<string, Step>): AgentBuilder;
  branch(condition: (history: StepResult[]) => boolean, branches: { true: (agent: AgentBuilder) => AgentBuilder; false: (agent: AgentBuilder) => AgentBuilder }): AgentBuilder;
  switch<T = string>(selector: (history: StepResult[]) => T, cases: Record<string, (agent: AgentBuilder) => AgentBuilder> & { default?: (agent: AgentBuilder) => AgentBuilder }): AgentBuilder;
  while(condition: (history: StepResult[]) => boolean, body: (agent: AgentBuilder) => AgentBuilder, opts?: { maxIterations?: number; timeout?: number }): AgentBuilder;
  forEach<T>(items: T[], body: (item: T, agent: AgentBuilder) => AgentBuilder): AgentBuilder;
  retryUntil(body: (agent: AgentBuilder) => AgentBuilder, successCondition: (result: StepResult) => boolean, opts?: { maxAttempts?: number; backoff?: number }): AgentBuilder;
  runAgent(subAgent: AgentBuilder, input?: { context?: Record<string, any> }): AgentBuilder;
=======
  parallel(stepsOrDict: Step[] | Record<string, Step>, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  branch(condition: (history: StepResult[]) => boolean, branches: { true: (agent: AgentBuilder) => AgentBuilder; false: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  switch<T = string>(selector: (history: StepResult[]) => T, cases: Record<string, (agent: AgentBuilder) => AgentBuilder> & { default?: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  while(condition: (history: StepResult[]) => boolean, body: (agent: AgentBuilder) => AgentBuilder, opts?: { maxIterations?: number; timeout?: number; pre?: () => void; post?: () => void }): AgentBuilder;
  forEach<T>(items: T[], body: (item: T, agent: AgentBuilder) => AgentBuilder, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  retryUntil(body: (agent: AgentBuilder) => AgentBuilder, successCondition: (result: StepResult) => boolean, opts?: { maxAttempts?: number; backoff?: number; pre?: () => void; post?: () => void }): AgentBuilder;
  runAgent(subAgent: AgentBuilder, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
  run(log?: (s: StepResult, stepIndex: number) => void): Promise<StepResult[]>;
  stream(log?: (s: StepResult, stepIndex: number) => void): AsyncGenerator<StepResult, void, unknown>;
}

function buildHistoryContextChunked(history: StepResult[], maxToolResults: number, maxChars: number): string {
  if (history.length === 0) return '';
  const last = history[history.length - 1];
  const chunks: string[] = [];
  if (last.llmOutput) {
    chunks.push('Previous LLM answer:\n');
    chunks.push(last.llmOutput);
    chunks.push('\n');
  }
  if (last.toolCalls && last.toolCalls.length > 0) {
    chunks.push('Previous tool results:\n');
    const recent = last.toolCalls.slice(-maxToolResults);
    for (const t of recent) {
      chunks.push('- ');
      chunks.push(t.name);
      chunks.push(' -> ');
      if (typeof t.result === 'string') {
        chunks.push(t.result);
      } else {
        try { chunks.push(JSON.stringify(t.result)); } catch { chunks.push('[unserializable]'); }
      }
      chunks.push('\n');
    }
  }
  // prefix header
  chunks.unshift('\n\n[Context from previous steps]\n');
  // assemble with maxChars cap
  let out = '';
  for (const c of chunks) {
    if (out.length + c.length > maxChars) break;
    out += c;
  }
  return out;
}

type AgentOptions = {
  llm?: LLMHandle;
  instructions?: string;
  timeout?: number;
  retry?: RetryConfig;
  // Context compaction options
  contextMaxChars?: number;            // soft cap for injected context size (default 4000)
  contextMaxToolResults?: number;      // number of recent tool results to include (default 3)
};

export function agent(opts?: AgentOptions): AgentBuilder {
  const steps: Array<Step | StepFactory | { __reset: true }> = [];
  const defaultLlm = opts?.llm;
  let contextHistory: StepResult[] = [];
  const globalInstructions = opts?.instructions;
  const defaultTimeoutMs = ((typeof opts?.timeout === 'number' ? opts!.timeout! : 60)) * 1000; // seconds -> ms
  const defaultRetry: RetryConfig = opts?.retry ?? { delay: 0, retries: 3 };
  const contextMaxChars = typeof opts?.contextMaxChars === 'number' ? opts!.contextMaxChars! : 20480;
  const contextMaxToolResults = typeof opts?.contextMaxToolResults === 'number' ? opts!.contextMaxToolResults! : 8;
  let isRunning = false;
  
  const builder: AgentBuilder = {
    resetHistory() { steps.push({ __reset: true }); return builder; },
    then(s: Step | StepFactory) { steps.push(s); return builder; },
    
    // Parallel execution
<<<<<<< HEAD
    parallel(stepsOrDict: Step[] | Record<string, Step>) {
      steps.push({ __parallel: stepsOrDict } as any);
=======
    parallel(stepsOrDict: Step[] | Record<string, Step>, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __parallel: stepsOrDict, __hooks: hooks } as any);
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
      return builder;
    },
    
    // Conditional branching
<<<<<<< HEAD
    branch(condition: (history: StepResult[]) => boolean, branches: { true: (agent: AgentBuilder) => AgentBuilder; false: (agent: AgentBuilder) => AgentBuilder }) {
      steps.push({ __branch: { condition, branches } } as any);
      return builder;
    },
    
    switch<T = string>(selector: (history: StepResult[]) => T, cases: Record<string, (agent: AgentBuilder) => AgentBuilder> & { default?: (agent: AgentBuilder) => AgentBuilder }) {
      steps.push({ __switch: { selector, cases } } as any);
=======
    branch(condition: (history: StepResult[]) => boolean, branches: { true: (agent: AgentBuilder) => AgentBuilder; false: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __branch: { condition, branches }, __hooks: hooks } as any);
      return builder;
    },
    
    switch<T = string>(selector: (history: StepResult[]) => T, cases: Record<string, (agent: AgentBuilder) => AgentBuilder> & { default?: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __switch: { selector, cases }, __hooks: hooks } as any);
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
      return builder;
    },
    
    // Loops
<<<<<<< HEAD
    while(condition: (history: StepResult[]) => boolean, body: (agent: AgentBuilder) => AgentBuilder, opts?: { maxIterations?: number; timeout?: number }) {
=======
    while(condition: (history: StepResult[]) => boolean, body: (agent: AgentBuilder) => AgentBuilder, opts?: { maxIterations?: number; timeout?: number; pre?: () => void; post?: () => void }) {
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
      steps.push({ __while: { condition, body, opts } } as any);
      return builder;
    },
    
<<<<<<< HEAD
    forEach<T>(items: T[], body: (item: T, agent: AgentBuilder) => AgentBuilder) {
      steps.push({ __forEach: { items, body } } as any);
      return builder;
    },
    
    retryUntil(body: (agent: AgentBuilder) => AgentBuilder, successCondition: (result: StepResult) => boolean, opts?: { maxAttempts?: number; backoff?: number }) {
=======
    forEach<T>(items: T[], body: (item: T, agent: AgentBuilder) => AgentBuilder, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __forEach: { items, body }, __hooks: hooks } as any);
      return builder;
    },
    
    retryUntil(body: (agent: AgentBuilder) => AgentBuilder, successCondition: (result: StepResult) => boolean, opts?: { maxAttempts?: number; backoff?: number; pre?: () => void; post?: () => void }) {
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
      steps.push({ __retryUntil: { body, successCondition, opts } } as any);
      return builder;
    },
    
    // Sub-agent composition
<<<<<<< HEAD
    runAgent(subAgent: AgentBuilder, input?: { context?: Record<string, any> }) {
      steps.push({ __runAgent: { subAgent, input } } as any);
=======
    runAgent(subAgent: AgentBuilder, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __runAgent: { subAgent }, __hooks: hooks } as any);
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
      return builder;
    },
    
    async run(log?: (s: StepResult, stepIndex: number) => void): Promise<StepResult[]> {
      if (isRunning) {
        throw new AgentConcurrencyError('This agent is already running. Create a new agent() instance for concurrent runs.');
      }
      isRunning = true;
      try {
        const out: StepResult[] = [];
        // snapshot steps array to make run isolated from later .then() calls
        const planned = [...steps];
        for (const raw of planned) {
          if ((raw as any).__reset) { contextHistory = []; continue; }
          
          // Handle advanced pattern steps
          if ((raw as any).__parallel) {
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            try {
              hooks?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for parallel:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const parallelResult = await executeParallel(
              (raw as any).__parallel,
              async (step: any) => {
                const subAgent = agent(opts).then(step);
                const results = await subAgent.run();
                return results[0];
              }
            );
            out.push(parallelResult);
            contextHistory.push(parallelResult);
            log?.(parallelResult, out.length - 1);
<<<<<<< HEAD
=======
            
            try {
              hooks?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for parallel:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__branch) {
            const { condition, branches } = (raw as any).__branch;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            
            try {
              hooks?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for branch:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const branchResults = await executeBranch(condition, branches, out, () => agent(opts));
            out.push(...branchResults);
            contextHistory.push(...branchResults);
            branchResults.forEach((r, i) => log?.(r, out.length - branchResults.length + i));
<<<<<<< HEAD
=======
            
            try {
              hooks?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for branch:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__switch) {
            const { selector, cases } = (raw as any).__switch;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            
            try {
              hooks?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for switch:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const switchResults = await executeSwitch(selector, cases, out, () => agent(opts));
            out.push(...switchResults);
            contextHistory.push(...switchResults);
            switchResults.forEach((r, i) => log?.(r, out.length - switchResults.length + i));
<<<<<<< HEAD
=======
            
            try {
              hooks?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for switch:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__while) {
            const { condition, body, opts: whileOpts } = (raw as any).__while;
<<<<<<< HEAD
=======
            
            try {
              whileOpts?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for while:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const whileResults = await executeWhile(condition, body, out, () => agent(opts), whileOpts);
            out.push(...whileResults);
            contextHistory.push(...whileResults);
            whileResults.forEach((r, i) => log?.(r, out.length - whileResults.length + i));
<<<<<<< HEAD
=======
            
            try {
              whileOpts?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for while:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__forEach) {
            const { items, body } = (raw as any).__forEach;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            
            try {
              hooks?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for forEach:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const forEachResults = await executeForEach(items, body, () => agent(opts));
            out.push(...forEachResults);
            contextHistory.push(...forEachResults);
            forEachResults.forEach((r, i) => log?.(r, out.length - forEachResults.length + i));
<<<<<<< HEAD
=======
            
            try {
              hooks?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for forEach:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__retryUntil) {
            const { body, successCondition, opts: retryOpts } = (raw as any).__retryUntil;
<<<<<<< HEAD
=======
            
            try {
              retryOpts?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for retryUntil:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const retryResults = await executeRetryUntil(body, successCondition, () => agent(opts), retryOpts);
            out.push(...retryResults);
            contextHistory.push(...retryResults);
            retryResults.forEach((r, i) => log?.(r, out.length - retryResults.length + i));
<<<<<<< HEAD
=======
            
            try {
              retryOpts?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for retryUntil:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__runAgent) {
            const { subAgent } = (raw as any).__runAgent;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            
            try {
              hooks?.pre?.();
            } catch (e) {
              console.warn('Pre-hook failed for runAgent:', e);
            }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const subResults = await executeRunAgent(subAgent);
            out.push(...subResults);
            contextHistory.push(...subResults);
            subResults.forEach((r, i) => log?.(r, out.length - subResults.length + i));
<<<<<<< HEAD
=======
            
            try {
              hooks?.post?.();
            } catch (e) {
              console.warn('Post-hook failed for runAgent:', e);
            }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          const s = typeof raw === 'function' ? (raw as StepFactory)(out) : (raw as Step);
          const stepTimeoutMs = (s as any).timeout != null ? (s as any).timeout * 1000 : defaultTimeoutMs; // seconds -> ms
          const retryCfg: RetryConfig = (s as any).retry ?? defaultRetry;
          const attemptsTotal = typeof retryCfg.retries === 'number' && retryCfg.retries! > 0 ? retryCfg.retries! : (defaultRetry.retries ?? 3);
          const useDelay = typeof retryCfg.delay === 'number' ? retryCfg.delay! : (defaultRetry.delay ?? 0);
          const useBackoff = retryCfg.backoff;
          if (useDelay && useBackoff) throw new Error('retry: specify either delay or backoff, not both');
  
          const doStep = async (): Promise<StepResult> => {
            // Execute pre-step hook
            if ((s as any).pre) {
              try {
                (s as any).pre();
              } catch (e) {
                console.warn('Pre-step hook failed:', e);
              }
            }
            
            const r: StepResult = {};
            const stepStart = Date.now();
            let llmTotalMs = 0;
            
            // Automatic tool selection with iterative tool calls
            if ("mcps" in s && "prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const cmr = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const cmc = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, cmr, cmc);
              r.prompt = (s as any).prompt;
              const availableTools = await discoverTools((s as any).mcps);
              if (availableTools.length === 0) {
                r.llmOutput = "No tools available for this request.";
              } else {
                const aggregated: Array<{ name: string; endpoint: string; result: any; ms?: number }> = [];
                const maxIterations = 4;
                let workingPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
                for (let i = 0; i < maxIterations; i++) {
                  const llmStart = Date.now();
                  let toolPlan: LLMToolResult;
                  try {
                    toolPlan = await usedLlm.genWithTools(workingPrompt, availableTools);
                  } catch (e) {
                    const provider = classifyProviderFromLlm(usedLlm);
                    throw normalizeError(e, 'llm', { stepId: out.length, provider });
                  }
                  llmTotalMs += Date.now() - llmStart;
                  if (!toolPlan || !Array.isArray(toolPlan.toolCalls) || toolPlan.toolCalls.length === 0) {
                    // finish with final content
                    r.llmOutput = toolPlan?.content || r.llmOutput;
                    break;
                  }
                  // Execute tools sequentially and append results to prompt for the next iteration
                  let toolResultsAppend = "\n\n[Tool results]\n";
                  for (const call of toolPlan.toolCalls) {
                    const mapped = call;
                    const handle = mapped?.mcpHandle;
                    if (!handle) continue;
                    // Validate args when schema known
                    try { validateWithSchema((availableTools.find(t => t.name === mapped.name) as any)?.parameters, mapped.arguments, `Tool ${mapped.name}`); } catch (e) { throw e; }
                    const idx = mapped.name.indexOf('.');
                    const actualToolName = idx >= 0 ? mapped.name.slice(idx + 1) : mapped.name;
                    const mcpStart = Date.now();
                    let result: any;
                    try {
                      result = await withMCP(handle, (c) => c.callTool({ name: actualToolName, arguments: mapped.arguments || {} }));
                    } catch (e) {
                      const provider = classifyProviderFromMcp(handle);
                      throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
                    }
                    const mcpMs = Date.now() - mcpStart;
                    aggregated.push({ name: mapped.name, endpoint: handle.url, result, ms: mcpMs });
                    toolResultsAppend += `- ${mapped.name} -> ${typeof result === 'string' ? result : JSON.stringify(result)}\n`;
                  }
                  if (aggregated.length) r.toolCalls = aggregated;
                  // Prepare next prompt with appended tool results
                  workingPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory + toolResultsAppend;
                  // On next iteration, model can produce final answer or ask for more tools
                }
                // Ensure toolCalls is always set for automatic tool selection steps
                if (!r.toolCalls) r.toolCalls = [];
              }
            }
            // LLM-only steps
            else if ("prompt" in s && !("mcp" in s) && !("mcps" in s)) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const cmr2 = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const cmc2 = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, cmr2, cmc2);
              const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
              r.prompt = (s as any).prompt;
              const llmStart = Date.now();
              try {
                r.llmOutput = await usedLlm.gen(finalPrompt);
              } catch (e) {
                const provider = classifyProviderFromLlm(usedLlm);
                throw normalizeError(e, 'llm', { stepId: out.length, provider });
              }
              llmTotalMs += Date.now() - llmStart;
            }
            // Explicit MCP tool calls (existing behavior)
            else if ("mcp" in s && "tool" in s) {
              if ("prompt" in s) {
                const usedLlm = (s as any).llm ?? defaultLlm;
                if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
                const stepInstructions = (s as any).instructions ?? globalInstructions;
                const cmr3 = (s as any).contextMaxToolResults ?? contextMaxToolResults;
                const cmc3 = (s as any).contextMaxChars ?? contextMaxChars;
                const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, cmr3, cmc3);
                const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
                r.prompt = (s as any).prompt;
                const llmStart = Date.now();
                r.llmOutput = await usedLlm.gen(finalPrompt);
                llmTotalMs += Date.now() - llmStart;
              }
              // Validate against tool schema if discoverable
              const schema = await getToolSchema((s as any).mcp, (s as any).tool);
              validateWithSchema(schema, (s as any).args ?? {}, `Tool ${(s as any).mcp.id}.${(s as any).tool}`);
              const mcpStart = Date.now();
              let res: any;
              try {
                res = await withMCP((s as any).mcp, (c) => c.callTool({ name: (s as any).tool, arguments: (s as any).args ?? {} }));
              } catch (e) {
                const provider = classifyProviderFromMcp((s as any).mcp);
                throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
              }
              const mcpMs = Date.now() - mcpStart;
              r.mcp = { endpoint: (s as any).mcp.url, tool: (s as any).tool, result: res, ms: mcpMs };
            }
  
            r.llmMs = llmTotalMs;
            r.durationMs = Date.now() - stepStart;
            
            // Execute post-step hook
            if ((s as any).post) {
              try {
                (s as any).post();
              } catch (e) {
                console.warn('Post-step hook failed:', e);
              }
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
            // classify
            const meta = { stepId: out.length } as VolcanoErrorMeta;
            let vErr: VolcanoError | undefined;
            if (e instanceof Error && /timed out/i.test(e.message)) {
              vErr = normalizeError(e, 'timeout', meta);
            } else if (e instanceof ValidationError || /failed schema validation/i.test(String((e as any)?.message || ''))) {
              vErr = normalizeError(e, 'validation', meta);
            } else {
              vErr = e as VolcanoError;
            }
            lastError = vErr || e;
            if (lastError instanceof VolcanoError && lastError.meta?.retryable === false) {
              throw lastError; // abort retries immediately for non-retryable errors
            }
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
        if (!result) throw (lastError instanceof VolcanoError ? lastError : new RetryExhaustedError('Retry attempts exhausted', { stepId: out.length }, { cause: lastError }));
  
          const r = result;
          log?.(r, out.length);
          out.push(r);
          contextHistory.push(r);
        }
        // Populate aggregated totals on the final step
        if (out.length > 0) {
          const totalDuration = out.reduce((acc, s) => acc + (s.durationMs || 0), 0);
          const totalLlm = out.reduce((acc, s) => acc + (s.llmMs || 0), 0);
          const totalMcp = out.reduce((acc, s) => {
            let accStep = acc;
            if (s.mcp?.ms) accStep += s.mcp.ms;
            if (s.toolCalls) accStep += s.toolCalls.reduce((a, t) => a + (t.ms || 0), 0);
            return accStep;
          }, 0);
          const last = out[out.length - 1];
          last.totalDurationMs = totalDuration;
          last.totalLlmMs = totalLlm;
          last.totalMcpMs = totalMcp;
        }
        return out;
      } finally {
        isRunning = false;
      }
    },
    async *stream(log?: (s: StepResult, stepIndex: number) => void): AsyncGenerator<StepResult, void, unknown> {
      if (isRunning) {
        throw new AgentConcurrencyError('This agent is already running. Create a new agent() instance for concurrent runs.');
      }
      isRunning = true;
      try {
        const out: StepResult[] = [];
        // snapshot steps array to make run isolated from later .then() calls
        const planned = [...steps];
        for (const raw of planned) {
          if ((raw as any).__reset) { contextHistory = []; continue; }
          
<<<<<<< HEAD
          // Handle advanced pattern steps (same as run())
          if ((raw as any).__parallel) {
=======
          // Handle advanced pattern steps (same as run() with hooks)
          if ((raw as any).__parallel) {
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for parallel:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const parallelResult = await executeParallel(
              (raw as any).__parallel,
              async (step: any) => {
                const subAgent = agent(opts).then(step);
                const results = await subAgent.run();
                return results[0];
              }
            );
            out.push(parallelResult);
            contextHistory.push(parallelResult);
            log?.(parallelResult, out.length - 1);
            yield parallelResult;
<<<<<<< HEAD
=======
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for parallel:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__branch) {
            const { condition, branches } = (raw as any).__branch;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for branch:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const branchResults = await executeBranch(condition, branches, out, () => agent(opts));
            out.push(...branchResults);
            contextHistory.push(...branchResults);
            for (const r of branchResults) {
              log?.(r, out.length - branchResults.length + branchResults.indexOf(r));
              yield r;
            }
<<<<<<< HEAD
=======
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for branch:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__switch) {
            const { selector, cases } = (raw as any).__switch;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for switch:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const switchResults = await executeSwitch(selector, cases, out, () => agent(opts));
            out.push(...switchResults);
            contextHistory.push(...switchResults);
            for (const r of switchResults) {
              log?.(r, out.length - switchResults.length + switchResults.indexOf(r));
              yield r;
            }
<<<<<<< HEAD
=======
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for switch:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__while) {
            const { condition, body, opts: whileOpts } = (raw as any).__while;
<<<<<<< HEAD
=======
            try { whileOpts?.pre?.(); } catch (e) { console.warn('Pre-hook failed for while:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const whileResults = await executeWhile(condition, body, out, () => agent(opts), whileOpts);
            out.push(...whileResults);
            contextHistory.push(...whileResults);
            for (const r of whileResults) {
              log?.(r, out.length - whileResults.length + whileResults.indexOf(r));
              yield r;
            }
<<<<<<< HEAD
=======
            
            try { whileOpts?.post?.(); } catch (e) { console.warn('Post-hook failed for while:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__forEach) {
            const { items, body } = (raw as any).__forEach;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for forEach:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const forEachResults = await executeForEach(items, body, () => agent(opts));
            out.push(...forEachResults);
            contextHistory.push(...forEachResults);
            for (const r of forEachResults) {
              log?.(r, out.length - forEachResults.length + forEachResults.indexOf(r));
              yield r;
            }
<<<<<<< HEAD
=======
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for forEach:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__retryUntil) {
            const { body, successCondition, opts: retryOpts } = (raw as any).__retryUntil;
<<<<<<< HEAD
=======
            try { retryOpts?.pre?.(); } catch (e) { console.warn('Pre-hook failed for retryUntil:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const retryResults = await executeRetryUntil(body, successCondition, () => agent(opts), retryOpts);
            out.push(...retryResults);
            contextHistory.push(...retryResults);
            for (const r of retryResults) {
              log?.(r, out.length - retryResults.length + retryResults.indexOf(r));
              yield r;
            }
<<<<<<< HEAD
=======
            
            try { retryOpts?.post?.(); } catch (e) { console.warn('Post-hook failed for retryUntil:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          if ((raw as any).__runAgent) {
            const { subAgent } = (raw as any).__runAgent;
<<<<<<< HEAD
=======
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for runAgent:', e); }
            
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            const subResults = await executeRunAgent(subAgent);
            out.push(...subResults);
            contextHistory.push(...subResults);
            for (const r of subResults) {
              log?.(r, out.length - subResults.length + subResults.indexOf(r));
              yield r;
            }
<<<<<<< HEAD
=======
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for runAgent:', e); }
>>>>>>> d037fb3aed5a92744c59d978cad319eb13775ff2
            continue;
          }
          
          const s = typeof raw === 'function' ? (raw as StepFactory)(out) : (raw as Step);
          const stepTimeoutMs = (s as any).timeout != null ? (s as any).timeout * 1000 : defaultTimeoutMs; // seconds -> ms
          const retryCfg: RetryConfig = (s as any).retry ?? defaultRetry;
          const attemptsTotal = typeof retryCfg.retries === 'number' && retryCfg.retries! > 0 ? retryCfg.retries! : (defaultRetry.retries ?? 3);
          const useDelay = typeof retryCfg.delay === 'number' ? retryCfg.delay! : (defaultRetry.delay ?? 0);
          const useBackoff = retryCfg.backoff;
          if (useDelay && useBackoff) throw new Error('retry: specify either delay or backoff, not both');
  
          const doStep = async (): Promise<StepResult> => {
            // Execute pre-step hook
            if ((s as any).pre) {
              try {
                (s as any).pre();
              } catch (e) {
                console.warn('Pre-step hook failed:', e);
              }
            }
            
            const r: StepResult = {};
            const stepStart = Date.now();
            let llmTotalMs = 0;
            
            // Automatic tool selection with iterative tool calls
            if ("mcps" in s && "prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const cmr = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const cmc = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, cmr, cmc);
              r.prompt = (s as any).prompt;
              const availableTools = await discoverTools((s as any).mcps);
              if (availableTools.length === 0) {
                r.llmOutput = "No tools available for this request.";
              } else {
                const aggregated: Array<{ name: string; endpoint: string; result: any; ms?: number }> = [];
                const maxIterations = 4;
                let workingPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
                for (let i = 0; i < maxIterations; i++) {
                  const llmStart = Date.now();
                  let toolPlan: LLMToolResult;
                  try {
                    toolPlan = await usedLlm.genWithTools(workingPrompt, availableTools);
                  } catch (e) {
                    const provider = classifyProviderFromLlm(usedLlm);
                    throw normalizeError(e, 'llm', { stepId: out.length, provider });
                  }
                  llmTotalMs += Date.now() - llmStart;
                  if (!toolPlan || !Array.isArray(toolPlan.toolCalls) || toolPlan.toolCalls.length === 0) {
                    // finish with final content
                    r.llmOutput = toolPlan?.content || r.llmOutput;
                    break;
                  }
                  // Execute tools sequentially and append results to prompt for the next iteration
                  let toolResultsAppend = "\n\n[Tool results]\n";
                  for (const call of toolPlan.toolCalls) {
                    const mapped = call;
                    const handle = mapped?.mcpHandle;
                    if (!handle) continue;
                    // Validate args when schema known
                    try { validateWithSchema((availableTools.find(t => t.name === mapped.name) as any)?.parameters, mapped.arguments, `Tool ${mapped.name}`); } catch (e) { throw e; }
                    const idx = mapped.name.indexOf('.');
                    const actualToolName = idx >= 0 ? mapped.name.slice(idx + 1) : mapped.name;
                    const mcpStart = Date.now();
                    let result: any;
                    try {
                      result = await withMCP(handle, (c) => c.callTool({ name: actualToolName, arguments: mapped.arguments || {} }));
                    } catch (e) {
                      const provider = classifyProviderFromMcp(handle);
                      throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
                    }
                    const mcpMs = Date.now() - mcpStart;
                    aggregated.push({ name: mapped.name, endpoint: handle.url, result, ms: mcpMs });
                    toolResultsAppend += `- ${mapped.name} -> ${typeof result === 'string' ? result : JSON.stringify(result)}\n`;
                  }
                  if (aggregated.length) r.toolCalls = aggregated;
                  // Prepare next prompt with appended tool results
                  workingPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory + toolResultsAppend;
                  // On next iteration, model can produce final answer or ask for more tools
                }
                // Ensure toolCalls is always set for automatic tool selection steps
                if (!r.toolCalls) r.toolCalls = [];
              }
            }
            // LLM-only steps
            else if ("prompt" in s && !("mcp" in s) && !("mcps" in s)) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const cmr2 = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const cmc2 = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, cmr2, cmc2);
              const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
              r.prompt = (s as any).prompt;
              const llmStart = Date.now();
              try {
                r.llmOutput = await usedLlm.gen(finalPrompt);
              } catch (e) {
                const provider = classifyProviderFromLlm(usedLlm);
                throw normalizeError(e, 'llm', { stepId: out.length, provider });
              }
              llmTotalMs += Date.now() - llmStart;
            }
            // Explicit MCP tool calls (existing behavior)
            else if ("mcp" in s && "tool" in s) {
              if ("prompt" in s) {
                const usedLlm = (s as any).llm ?? defaultLlm;
                if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
                const stepInstructions = (s as any).instructions ?? globalInstructions;
                const cmr3 = (s as any).contextMaxToolResults ?? contextMaxToolResults;
                const cmc3 = (s as any).contextMaxChars ?? contextMaxChars;
                const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, cmr3, cmc3);
                const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
                r.prompt = (s as any).prompt;
                const llmStart = Date.now();
                r.llmOutput = await usedLlm.gen(finalPrompt);
                llmTotalMs += Date.now() - llmStart;
              }
              // Validate against tool schema if discoverable
              const schema = await getToolSchema((s as any).mcp, (s as any).tool);
              validateWithSchema(schema, (s as any).args ?? {}, `Tool ${(s as any).mcp.id}.${(s as any).tool}`);
              const mcpStart = Date.now();
              let res: any;
              try {
                res = await withMCP((s as any).mcp, (c) => c.callTool({ name: (s as any).tool, arguments: (s as any).args ?? {} }));
              } catch (e) {
                const provider = classifyProviderFromMcp((s as any).mcp);
                throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
              }
              const mcpMs = Date.now() - mcpStart;
              r.mcp = { endpoint: (s as any).mcp.url, tool: (s as any).tool, result: res, ms: mcpMs };
            }
  
            r.llmMs = llmTotalMs;
            r.durationMs = Date.now() - stepStart;
            
            // Execute post-step hook
            if ((s as any).post) {
              try {
                (s as any).post();
              } catch (e) {
                console.warn('Post-step hook failed:', e);
              }
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
            // classify
            const meta = { stepId: out.length } as VolcanoErrorMeta;
            let vErr: VolcanoError | undefined;
            if (e instanceof Error && /timed out/i.test(e.message)) {
              vErr = normalizeError(e, 'timeout', meta);
            } else if (e instanceof ValidationError || /failed schema validation/i.test(String((e as any)?.message || ''))) {
              vErr = normalizeError(e, 'validation', meta);
            } else {
              vErr = e as VolcanoError;
            }
            lastError = vErr || e;
            if (lastError instanceof VolcanoError && lastError.meta?.retryable === false) {
              throw lastError; // abort retries immediately for non-retryable errors
            }
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
        if (!result) throw (lastError instanceof VolcanoError ? lastError : new RetryExhaustedError('Retry attempts exhausted', { stepId: out.length }, { cause: lastError }));
  
          const r = result;
          log?.(r, out.length);
          out.push(r);
          contextHistory.push(r);
          
          // Yield the step result for streaming
          yield r;
        }
        // Note: We don't populate aggregated totals for streaming since it's incremental
      } finally {
        isRunning = false;
      }
    },
  };
  
  return builder;
}
