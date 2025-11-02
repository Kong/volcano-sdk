// src/volcano-sdk.ts
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { llmOpenAI as llmOpenAIProvider, llmOpenAIResponses as llmOpenAIResponsesProvider } from "./llms/openai.js";
import { executeParallel, executeBranch, executeSwitch, executeWhile, executeForEach, executeRetryUntil, executeRunAgent } from "./patterns.js";
import { createHash } from "node:crypto";
import { recordTokenMetrics, getLLMProviderId } from "./token-utils.js";
import * as CONSTANTS from "./constants.js";
export { llmAnthropic } from "./llms/anthropic.js";
export { llmLlama } from "./llms/llama.js";
export { llmMistral } from "./llms/mistral.js";
export { llmBedrock } from "./llms/bedrock.js";
export { llmVertexStudio } from "./llms/vertex-studio.js";
export { llmAzure } from "./llms/azure.js";
export { createVolcanoTelemetry, noopTelemetry } from "./telemetry.js";
export type { VolcanoTelemetryConfig, VolcanoTelemetry } from "./telemetry.js";
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
export const llmOpenAIResponses = llmOpenAIResponsesProvider;

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
  return `llm:${getLLMProviderId(usedLlm)}`;
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
export type MCPAuthConfig = {
  type: 'oauth' | 'bearer';
  token?: string;           // For bearer auth: direct token
  clientId?: string;        // For OAuth: client credentials
  clientSecret?: string;
  tokenEndpoint?: string;   // OAuth token endpoint (for OAuth)
  scope?: string;           // OAuth scope (optional, some servers require it)
};

export type MCPHandle = { 
  listTools: () => Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: any }> }>;
  callTool: (name: string, args: Record<string, any>) => Promise<any>;
  id: string; 
  url: string; 
  auth?: MCPAuthConfig;
};

/**
 * Connect to an MCP (Model Context Protocol) server via HTTP.
 * Supports connection pooling, OAuth/Bearer authentication, and automatic reconnection.
 * 
 * @param url - HTTP endpoint URL for the MCP server (e.g., "http://localhost:3000/mcp")
 * @param options - Optional authentication configuration (OAuth 2.1 or Bearer token)
 * @returns MCPHandle for listing and calling tools
 * 
 * @example
 * // Basic usage
 * const weather = mcp("http://localhost:3000/mcp");
 * const tools = await weather.listTools();
 * const forecast = await weather.callTool("get_forecast", { city: "San Francisco" });
 * 
 * @example
 * // With OAuth authentication
 * const github = mcp("https://api.github.com/mcp", {
 *   auth: {
 *     type: 'oauth',
 *     clientId: process.env.GITHUB_CLIENT_ID!,
 *     clientSecret: process.env.GITHUB_SECRET!,
 *     tokenUrl: 'https://github.com/login/oauth/access_token'
 *   }
 * });
 */
export function mcp(url: string, options?: { auth?: MCPAuthConfig }): MCPHandle {
  // Use hash-based ID to keep tool names under OpenAI's 64-char limit
  // Tool names are: ${id}.${toolName}, so short ID = more room for tool names
  const hash = createHash('md5').update(url).digest('hex').substring(0, 8);
  const id = `mcp_${hash}`; // e.g., "mcp_f3c8a9b1" (12 chars, deterministic)
  
  return { 
    id, 
    url, 
    auth: options?.auth,
    listTools: async () => {
      return withMCP({ id, url, auth: options?.auth } as MCPHandle, (c) => c.listTools());
    },
    callTool: async (name, args) => {
      return withMCP({ id, url, auth: options?.auth } as MCPHandle, (c) => c.callTool({ name, arguments: args }));
    }
  };
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
  auth?: MCPAuthConfig;
};

const MCP_POOL = new Map<string, MCPPoolEntry>();
let MCP_POOL_MAX = CONSTANTS.DEFAULT_MCP_POOL_MAX_SIZE;
let MCP_POOL_IDLE_MS = CONSTANTS.DEFAULT_MCP_POOL_IDLE_MS;

// OAuth token cache: endpoint -> { token, expiresAt }
type TokenCacheEntry = { token: string; expiresAt: number };
const OAUTH_TOKEN_CACHE = new Map<string, TokenCacheEntry>();

async function getOAuthToken(auth: MCPAuthConfig, endpoint: string): Promise<string> {
  // Check cache first
  const cached = OAUTH_TOKEN_CACHE.get(endpoint);
  if (cached && cached.expiresAt > Date.now() + CONSTANTS.OAUTH_TOKEN_EXPIRY_BUFFER_MS) {
    return cached.token;
  }
  
  // Acquire new token
  if (!auth.tokenEndpoint || !auth.clientId || !auth.clientSecret) {
    throw new Error(`OAuth auth requires tokenEndpoint, clientId, and clientSecret`);
  }
  
  // OAuth 2.0 RFC 6749 requires application/x-www-form-urlencoded for token requests
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: auth.clientId,
    client_secret: auth.clientSecret
  });
  
  // Add scope if provided (some OAuth servers require it)
  if (auth.scope) {
    params.set('scope', auth.scope);
  }
  
  const response = await fetch(auth.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  
  if (!response.ok) {
    throw new Error(`OAuth token acquisition failed: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  const token = data.access_token;
  const expiresIn = data.expires_in || 3600; // default 1 hour
  
  // Cache the token
  OAUTH_TOKEN_CACHE.set(endpoint, {
    token,
    expiresAt: Date.now() + (expiresIn * 1000)
  });
  
  return token;
}


async function getPooledClient(url: string, auth?: MCPAuthConfig): Promise<MCPPoolEntry> {
  const poolKey = auth ? `${url}::auth` : url; // Separate pool entries for auth vs non-auth
  let entry = MCP_POOL.get(poolKey);
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
    
    // Create transport
    const transport = new StreamableHTTPClientTransport(new URL(url));
    
    const client = new MCPClient({ name: "volcano-sdk", version: "0.0.1" });
    
    // Connect with auth if needed
    if (auth) {
      await connectWithAuth(transport, client, auth, url);
    } else {
      await client.connect(transport);
    }
    
    entry = { client, transport, lastUsed: Date.now(), busyCount: 0, auth };
    MCP_POOL.set(poolKey, entry);
  }
  entry.busyCount++;
  entry.lastUsed = Date.now();
  return entry;
}

async function connectWithAuth(transport: any, client: MCPClient, auth: MCPAuthConfig, endpoint: string) {
  // Get auth headers
  const authHeaders: Record<string, string> = {};
  
  if (auth.type === 'oauth') {
    const token = await getOAuthToken(auth, endpoint);
    authHeaders['Authorization'] = `Bearer ${token}`;
  } else if (auth.type === 'bearer' && auth.token) {
    authHeaders['Authorization'] = `Bearer ${auth.token}`;
  }
  
  // Wrap fetch globally during connect
  const originalFetch = global.fetch;
  global.fetch = async (url: any, init: any = {}) => {
    let mergedHeaders: any = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value: string, key: string) => {
          mergedHeaders[key] = value;
        });
      } else {
        mergedHeaders = { ...init.headers };
      }
    }
    Object.assign(mergedHeaders, authHeaders);
    
    return originalFetch(url, {
      ...init,
      headers: mergedHeaders
    });
  };
  
  try {
    await client.connect(transport);
  } finally {
    global.fetch = originalFetch;
  }
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
    POOL_SWEEPER = setInterval(() => { cleanupIdlePool(); }, CONSTANTS.DEFAULT_MCP_POOL_SWEEP_INTERVAL_MS);
    // In tests or short-lived processes we don't need to keep the event loop alive
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
export function __internal_clearOAuthTokenCache() { OAUTH_TOKEN_CACHE.clear(); }
export function __internal_getOAuthTokenCache() { 
  return Array.from(OAUTH_TOKEN_CACHE.entries()).map(([endpoint, entry]) => ({ 
    endpoint, 
    token: entry.token, 
    expiresAt: entry.expiresAt 
  })); 
}

async function withMCP<T>(h: MCPHandle, fn: (c: MCPClient) => Promise<T>, telemetry?: any, operation?: string): Promise<T> {
  ensurePoolSweeper();
  const poolKey = h.auth ? `${h.url}::auth` : h.url;
  const entry = await getPooledClient(h.url, h.auth);
  
  // Start MCP span if telemetry configured
  const mcpSpan = telemetry && operation ? telemetry.startMCPSpan(null, h, operation) : null;
  
  try {
    let result: T;
    // Always wrap with auth if configured (for both connect and tool calls)
    if (h.auth || entry.auth) {
      const authConfig = h.auth || entry.auth!;
      result = await executeWithAuth(authConfig, h.url, () => fn(entry.client));
    } else {
      result = await fn(entry.client);
    }
    
    telemetry?.endSpan(mcpSpan);
    telemetry?.recordMetric('mcp.call', 1, { endpoint: h.url, error: false });
    
    return result;
  } catch (error) {
    telemetry?.endSpan(mcpSpan, undefined, error);
    telemetry?.recordMetric('mcp.call', 1, { endpoint: h.url, error: true });
    throw error;
  } finally { 
    const e = MCP_POOL.get(poolKey);
    if (e) {
      e.busyCount = Math.max(0, e.busyCount - 1);
      e.lastUsed = Date.now();
    }
  }
}

async function executeWithAuth<T>(auth: MCPAuthConfig, endpoint: string, fn: () => Promise<T>): Promise<T> {
  // Get auth headers
  const authHeaders: Record<string, string> = {};
  
  if (auth.type === 'oauth') {
    const token = await getOAuthToken(auth, endpoint);
    authHeaders['Authorization'] = `Bearer ${token}`;
  } else if (auth.type === 'bearer' && auth.token) {
    authHeaders['Authorization'] = `Bearer ${auth.token}`;
  }
  
  // Wrap fetch
  const originalFetch = global.fetch;
  global.fetch = async (url: any, init: any = {}) => {
    let mergedHeaders: any = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value: string, key: string) => {
          mergedHeaders[key] = value;
        });
      } else {
        mergedHeaders = { ...init.headers };
      }
    }
    Object.assign(mergedHeaders, authHeaders);
    
    return originalFetch(url, {
      ...init,
      headers: mergedHeaders
    });
  };
  
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
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
let TOOL_CACHE_TTL_MS = CONSTANTS.DEFAULT_TOOL_CACHE_TTL_MS;

/**
 * Discover all available tools from one or more MCP servers.
 * Results are cached for 60 seconds to improve performance.
 * 
 * @param handles - Array of MCP handles to query for tools
 * @returns Combined array of all available tools from all servers
 * 
 * @example
 * const weather = mcp("http://localhost:3000/mcp");
 * const calendar = mcp("http://localhost:4000/mcp");
 * const tools = await discoverTools([weather, calendar]);
 * console.log(tools.map(t => t.name)); // ["get_forecast", "create_event", ...]
 */
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
      // Invalidate cache on failure
      TOOL_CACHE.delete(handle.url);
      // Fail fast - throw connection error
      throw normalizeError(error, 'mcp-conn', { 
        provider: classifyProviderFromMcp(handle),
        retryable: true  // Connection errors are retryable
      });
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

/**
 * Metadata provided to stream-level onToken callback.
 * Allows conditional processing based on whether step-level handler already processed the token.
 * 
 * @property stepIndex - Index of the current step (0-based)
 * @property handledByStep - True if step-level onToken handled this token. Use this to avoid double-processing.
 * @property stepPrompt - The prompt for this step (useful for conditional formatting)
 * @property llmProvider - The LLM provider ID (e.g., "OpenAI-gpt-4o-mini", "Anthropic-claude-3")
 * 
 * @example
 * .stream({
 *   onToken: (token, meta) => {
 *     if (!meta.handledByStep) {
 *       // Only process if step didn't handle it
 *       res.write(`data: ${token}\n\n`);
 *     }
 *     // Always log analytics
 *     analytics.track(token, meta.stepIndex);
 *   }
 * })
 */
export type TokenMetadata = {
  stepIndex: number;
  handledByStep: boolean;
  stepPrompt?: string;
  llmProvider?: string;
};

/**
 * Options for the stream() method.
 * Supports both token-level and step-level callbacks for maximum flexibility.
 * 
 * @property onToken - Called for each token as it arrives (with metadata). 
 *                     Step-level onToken takes precedence - when a step has its own onToken,
 *                     this callback won't receive tokens from that step (meta.handledByStep will be true).
 * @property onStep - Called when each step completes. Equivalent to the callback in stream(callback).
 * 
 * @example
 * // Both token and step callbacks
 * .stream({
 *   onToken: (token, meta) => {
 *     console.log(`Token from step ${meta.stepIndex}: ${token}`);
 *   },
 *   onStep: (step, index) => {
 *     console.log(`Step ${index} complete: ${step.durationMs}ms`);
 *   }
 * })
 * 
 * @example
 * // Backward compatible: just a callback
 * .stream((step, index) => {
 *   console.log(`Step ${index} done`);
 * })
 */
export type StreamOptions = {
  onToken?: (token: string, meta: TokenMetadata) => void;
  onStep?: (step: StepResult, stepIndex: number) => void;
};

export type Step =
  | { prompt: string; name?: string; llm?: LLMHandle; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void; onToken?: (token: string) => void }
  | { mcp: MCPHandle; name?: string; tool: string; args?: Record<string, any>; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void }
  | { prompt: string; name?: string; llm?: LLMHandle; mcp: MCPHandle; tool: string; args?: Record<string, any>; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; pre?: () => void; post?: () => void }
  | { prompt: string; name?: string; llm?: LLMHandle; mcps: MCPHandle[]; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; maxToolIterations?: number; pre?: () => void; post?: () => void; onToken?: (token: string) => void }
  | { prompt: string; name?: string; llm?: LLMHandle; agents: AgentBuilder[]; instructions?: string; timeout?: number; retry?: RetryConfig; contextMaxChars?: number; contextMaxToolResults?: number; maxAgentIterations?: number; pre?: () => void; post?: () => void };

export type StepResult = {
  prompt?: string;
  llmOutput?: string;
  // Total wall time for this step (successful attempt) in milliseconds
  durationMs?: number;
  // Total LLM time spent during this step (sum across iterations) in milliseconds
  llmMs?: number;
  mcp?: { endpoint: string; tool: string; result: any; ms?: number };
  toolCalls?: Array<{ name: string; arguments?: Record<string, any>; endpoint: string; result: any } & { ms?: number }>;
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
  name?: string;
  description?: string;
  resetHistory(): AgentBuilder;
  then(s: Step | StepFactory): AgentBuilder;
  parallel(stepsOrDict: Step[] | Record<string, Step>, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  branch(condition: (history: StepResult[]) => boolean, branches: { true: (agent: AgentBuilder) => AgentBuilder; false: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  switch<T = string>(selector: (history: StepResult[]) => T, cases: Record<string, (agent: AgentBuilder) => AgentBuilder> & { default?: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  while(condition: (history: StepResult[]) => boolean, body: (agent: AgentBuilder) => AgentBuilder, opts?: { maxIterations?: number; timeout?: number; pre?: () => void; post?: () => void }): AgentBuilder;
  forEach<T>(items: T[], body: (item: T, agent: AgentBuilder) => AgentBuilder, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  retryUntil(body: (agent: AgentBuilder) => AgentBuilder, successCondition: (result: StepResult) => boolean, opts?: { maxAttempts?: number; backoff?: number; pre?: () => void; post?: () => void }): AgentBuilder;
  runAgent(subAgent: AgentBuilder, hooks?: { pre?: () => void; post?: () => void }): AgentBuilder;
  run(log?: (s: StepResult, stepIndex: number) => void): Promise<StepResult[]>;
  stream(optionsOrLog?: StreamOptions | ((s: StepResult, stepIndex: number) => void)): AsyncGenerator<StepResult, void, unknown>;
}

function safeExecuteHook(hook: (() => void) | undefined, hookName: string): void {
  if (!hook) return;
  try {
    hook();
  } catch (e) {
    console.warn(`${hookName} hook failed:`, e);
  }
}

function buildHistoryContextChunked(history: StepResult[], maxToolResults: number, maxChars: number): string {
  if (history.length === 0) return '';
  
  const chunks: string[] = [];
  
  // Include LLM outputs from all steps (not just last one)
  // This is important for subagents to see parent conversation history
  // contextMaxChars will truncate if this gets too long
  const llmOutputs: string[] = [];
  for (const step of history) {
    if (step.llmOutput) {
      llmOutputs.push(step.llmOutput);
    }
  }
  
  if (llmOutputs.length > 0) {
    if (llmOutputs.length === 1) {
    chunks.push('Previous LLM answer:\n');
      chunks.push(llmOutputs[0]);
    } else {
      chunks.push('Previous LLM answers:\n');
      llmOutputs.forEach((output, idx) => {
        chunks.push(`${idx + 1}. ${output}\n`);
      });
    }
    chunks.push('\n');
  }
  
  // Collect tool calls from ALL recent steps (not just last step)
  const allToolCalls: Array<{ name: string; arguments?: Record<string, any>; result: any }> = [];
  for (const step of history) {
    if (step.toolCalls && step.toolCalls.length > 0) {
      allToolCalls.push(...step.toolCalls);
    }
  }
  
  if (allToolCalls.length > 0) {
    chunks.push('Previous tool results:\n');
    // Take the most recent maxToolResults across ALL steps
    const recent = allToolCalls.slice(-maxToolResults);
    for (const t of recent) {
      chunks.push('- ');
      chunks.push(t.name);
      // Include arguments to preserve context like issue numbers, IDs, etc
      if (t.arguments) {
        try {
          chunks.push('(');
          chunks.push(JSON.stringify(t.arguments));
          chunks.push(')');
        } catch {
          // Skip if arguments can't be serialized
        }
      }
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

/**
 * Helper function to execute LLM generation with optional token streaming.
 * Handles both step-level and stream-level onToken callbacks with proper precedence.
 */
async function executeLLMWithStreaming(
  llm: LLMHandle,
  prompt: string,
  stepOnToken: ((token: string) => void) | undefined,
  streamOnToken: ((token: string, meta: TokenMetadata) => void) | undefined,
  meta: { stepIndex: number; stepPrompt?: string }
): Promise<string> {
  const hasStepOnToken = !!stepOnToken;
  const effectiveOnToken = stepOnToken || streamOnToken;
  
  if (effectiveOnToken && typeof llm.genStream === 'function') {
    const tokens: string[] = [];
    const tokenMeta: TokenMetadata = {
      stepIndex: meta.stepIndex,
      handledByStep: hasStepOnToken,
      stepPrompt: meta.stepPrompt,
      llmProvider: (llm as any).id || llm.model
    };
    
    for await (const token of llm.genStream(prompt)) {
      tokens.push(token);
      try {
        if (hasStepOnToken) {
          stepOnToken!(token);
        } else {
          streamOnToken!(token, tokenMeta);
        }
      } catch (e) {
        console.warn('onToken callback failed:', e);
      }
    }
    return tokens.join('');
  } else {
    return await llm.gen(prompt);
  }
}



/**
 * Shared display helpers for consistent progress formatting.
 */
const createProgressDisplay = (workflowStart: number, isTTY: boolean) => ({
  showWaiting: () => {
    console.log('\n   ⏳ Waiting for LLM');
  },
  
  showTokens: (count: number, provider?: string) => {
    const elapsed = (Date.now() - workflowStart) / 1000;
    const throughput = Math.round(count / Math.max(elapsed, 0.1));
    const providerInfo = provider ? ` (via ${provider})` : '';
    
    if (count === 1) {
      // Clear waiting message (move up one line)
      process.stdout.write('\x1b[1A\r\x1b[K');
    }
    if (count % 10 === 0 || count === 1) {
      process.stdout.write(`\r   💭 ${count} tokens | ${throughput} tok/s${providerInfo}`);
    }
  },
  
  showComplete: (durationMs: number, tokens: number, provider?: string) => {
    if (isTTY) process.stdout.write('\r\x1b[K');
    const providerInfo = provider ? ` | ${provider}` : '';
    console.log(`   ✅ Complete | ${tokens.toLocaleString()} token${tokens > 1 ? 's' : ''} | ${(durationMs/1000).toFixed(1)}s${providerInfo}\n`);
  }
});

/**
 * Create beautiful TTY progress handler for workflows.
 */
function createProgressHandler(totalSteps: number, isSubAgent: boolean = false, isExplicitSubAgent: boolean = false, parentStepIndex?: number, parentTotalSteps?: number) {
  const workflowStart = Date.now();
  const isTTY = process.stdout?.isTTY || false;
  const display = createProgressDisplay(workflowStart, isTTY);
  let operationStart = Date.now();
  let waitInterval: NodeJS.Timeout | null = null;
  
  if (!isSubAgent) {
    console.log(`\n🌋 Running Volcano agent [volcano-sdk v${CONSTANTS.VOLCANO_SDK_VERSION}] • docs at https://volcano.dev`);
    console.log('━'.repeat(50));
  }

  return {
    stepStart: (stepIndex: number, prompt?: string) => {
      // For agent crews (delegated agents), suppress step start (parent shows delegation)
      if (isSubAgent && !isExplicitSubAgent) return;
      
      // For explicit sub-agents, use parent step numbering
      const display = prompt?.substring(0, 60) || 'Processing';
      const actualStepNum = (isExplicitSubAgent && parentStepIndex !== undefined) ? parentStepIndex + stepIndex + 1 : stepIndex + 1;
      const actualTotalSteps = (isExplicitSubAgent && parentTotalSteps !== undefined) ? parentTotalSteps : totalSteps;
      console.log(`🤖 Step ${actualStepNum}/${actualTotalSteps}: ${display}${prompt && prompt.length > 60 ? '...' : ''}`);
    },
    startLlmOperation: () => {
      operationStart = Date.now();
      // Show elapsed time while waiting for first token
      if (isTTY && !isSubAgent) {
        waitInterval = setInterval(() => {
          const elapsed = ((Date.now() - operationStart) / 1000).toFixed(1);
          process.stdout.write(`\r   ⏳ Waiting for LLM | ${elapsed}s`);
        }, 100);
      }
    },
    llmToken: (count: number, provider?: string) => {
      // For agent crews, suppress token progress (parent tracks via onToken callback)
      // For explicit sub-agents, show token progress
      if (isSubAgent && !isExplicitSubAgent) return;
      
      // Clear waiting interval on first token
      if (count === 1 && waitInterval) {
        clearInterval(waitInterval);
        waitInterval = null;
      }
      
      const elapsed = (Date.now() - operationStart) / 1000;
      const throughput = Math.round(count / Math.max(elapsed, 0.1));
      if (count % 10 === 0 || count === 1) {
        const providerInfo = provider ? ` | ${provider}` : '';
        process.stdout.write(`\r   💭 ${count} tokens | ${throughput} tok/s | ${elapsed.toFixed(1)}s${providerInfo}`);
      }
    },
    agentStart: (agentName: string, task: string) => {
      console.log(`\n⚡ ${agentName} → ${task.substring(0, 50)}...`);
      operationStart = Date.now();
      // Show elapsed time while waiting for first token
      if (isTTY) {
        waitInterval = setInterval(() => {
          const elapsed = ((Date.now() - operationStart) / 1000).toFixed(1);
          process.stdout.write(`\r   ⏳ Waiting for LLM | ${elapsed}s`);
        }, 100);
      } else {
        process.stdout.write('   ⏳ Waiting for LLM');
      }
    },
    agentToken: (count: number, provider?: string) => {
      // Clear waiting interval on first token
      if (count === 1 && waitInterval) {
        clearInterval(waitInterval);
        waitInterval = null;
      }
      
      const elapsed = (Date.now() - operationStart) / 1000;
      const throughput = Math.round(count / Math.max(elapsed, 0.1));
      if (count % 10 === 0 || count === 1) {
        if (count === 1) {
          // First token - clear the "Waiting..." line
          process.stdout.write('\r\x1b[K');
        }
        const providerInfo = provider ? ` | ${provider}` : '';
        process.stdout.write(`\r   💭 ${count} tokens | ${throughput} tok/s | ${elapsed.toFixed(1)}s${providerInfo}`);
      }
    },
    agentComplete: (agentName: string, tokens: number, durationMs: number, provider?: string) => {
      display.showComplete(durationMs, tokens, provider);
    },
    stepComplete: (durationMs: number, tokenCount?: number, provider?: string, crewTokens?: number, crewModels?: string[]) => {
      // For agent crews, suppress step complete (parent shows completion)
      // For explicit sub-agents, show step complete
      if (isSubAgent && !isExplicitSubAgent) return;
      
      if (crewTokens && crewModels) {
        // Crew workflow - don't show anything here, workflowEnd will show the final summary
        return;
      } else if (tokenCount) {
        display.showComplete(durationMs, tokenCount, provider);
      } else {
        if (isTTY) process.stdout.write('\r\x1b[K');
        console.log(`   ✅ Complete | ${(durationMs/1000).toFixed(1)}s\n`);
      }
    },
    workflowEnd: (stepCount: number, totalTokens?: number, totalDuration?: number, models?: string[]) => {
      if (isSubAgent) return; // Suppress footer for sub-agents
      
      console.log('━'.repeat(50));
      if (totalTokens && models && models.length > 0) {
        const modelsList = models.join(', ');
        console.log(`🎉 Agent complete | ${totalTokens.toLocaleString()} tokens | ${((totalDuration || 0)/1000).toFixed(1)}s | ${modelsList}`);
      } else {
        const total = (Date.now() - workflowStart) / 1000;
        console.log(`🎉 Workflow complete! ${stepCount} step${stepCount > 1 ? 's' : ''} in ${total.toFixed(1)}s`);
      }
    }
  };
}

/**
 * Build agent context string for multi-agent coordination.
 */
function buildAgentContext(agents: AgentBuilder[]): string {
  const agentList = agents
    .filter(a => a.name && a.description)
    .map(a => `- ${a.name}: ${a.description}`)
    .join('\n');
  
  return `

Available agents to help you:
${agentList}

To delegate to an agent, respond with: USE [agent_name]: [specific task for that agent]
When you have the final answer, respond with: DONE: [your final answer]
`;
}

/**
 * Parse coordinator LLM response for agent delegation.
 */
function parseAgentDecision(response: string): 
  | { type: 'use_agent'; agentName: string; task: string }
  | { type: 'done'; answer: string }
  | { type: 'continue'; raw: string }
{
  const useMatch = response.match(/USE\s+(\w+):\s*(.+?)(?=\n(?:USE|DONE:)|$)/s);
  if (useMatch) {
    return {
      type: 'use_agent',
      agentName: useMatch[1].trim(),
      task: useMatch[2].trim()
    };
  }
  
  const doneMatch = response.match(/DONE:\s*(.+)/s);
  if (doneMatch) {
    return {
      type: 'done',
      answer: doneMatch[1].trim()
    };
  }
  
  return {
    type: 'continue',
    raw: response
  };
}

type AgentOptions = {
  llm?: LLMHandle;
  instructions?: string;
  name?: string;                       // Agent name for multi-agent coordination
  description?: string;                // Agent description for automatic selection
  hideProgress?: boolean;              // Disable beautiful TTY progress output (progress shown by default)
  timeout?: number;
  retry?: RetryConfig;
  // Context compaction options
  contextMaxChars?: number;            // soft cap for injected context size (default 4000)
  contextMaxToolResults?: number;      // number of recent tool results to include (default 3)
  // MCP authentication configuration per endpoint
  mcpAuth?: Record<string, MCPAuthConfig>;
  // OpenTelemetry observability (opt-in)
  telemetry?: import('./telemetry.js').VolcanoTelemetry;
  // Maximum tool calling iterations for automatic selection (default 4)
  maxToolIterations?: number;
};

/**
 * Create an AI agent that chains LLM reasoning with MCP tool calls.
 * 
 * @param opts - Optional configuration including LLM provider, instructions, timeout, retry policy, and observability
 * @returns AgentBuilder for chaining steps with .then(), run(), and stream()
 * 
 * @example
 * // Simple agent
 * const results = await agent({ llm: llmOpenAI({...}) })
 *   .then({ prompt: "Analyze data" })
 *   .then({ prompt: "Generate insights" })
 *   .run();
 * 
 * @example
 * // With automatic tool selection
 * await agent({ llm })
 *   .then({ 
 *     prompt: "Book a meeting and send confirmation", 
 *     mcps: [calendar, email] 
 *   })
 *   .run();
 */
export function agent(opts?: AgentOptions): AgentBuilder {
  const steps: Array<Step | StepFactory | { __reset: true }> = [];
  const defaultLlm = opts?.llm;
  let contextHistory: StepResult[] = [];
  let inheritedParentContext = false;
  const globalInstructions = opts?.instructions;
  const agentName = opts?.name;
  const agentDescription = opts?.description;
  const showProgress = !opts?.hideProgress;
  const defaultTimeoutMs = (opts?.timeout ?? CONSTANTS.DEFAULT_TIMEOUT_SECONDS) * 1000;
  const defaultRetry: RetryConfig = opts?.retry ?? { delay: CONSTANTS.DEFAULT_RETRY_DELAY_SECONDS, retries: CONSTANTS.DEFAULT_RETRY_ATTEMPTS };
  const contextMaxChars = opts?.contextMaxChars ?? CONSTANTS.DEFAULT_CONTEXT_MAX_CHARS;
  const contextMaxToolResults = opts?.contextMaxToolResults ?? CONSTANTS.DEFAULT_CONTEXT_MAX_TOOL_RESULTS;
  const agentMcpAuth = opts?.mcpAuth || {};
  const telemetry = opts?.telemetry;
  const defaultMaxToolIterations = opts?.maxToolIterations ?? CONSTANTS.DEFAULT_MAX_TOOL_ITERATIONS;
  let isRunning = false;
  
  function applyAgentAuth(handle: MCPHandle): MCPHandle {
    if (handle.auth) return handle; // Handle-level auth takes precedence
    const authConfig = agentMcpAuth[handle.url];
    if (authConfig) {
      return { ...handle, auth: authConfig };
    }
    return handle;
  }
  
  const builder: AgentBuilder = {
    name: agentName,
    description: agentDescription,
    resetHistory() { steps.push({ __reset: true }); return builder; },
    then(s: Step | StepFactory) { steps.push(s); return builder; },
    
    // Parallel execution
    parallel(stepsOrDict: Step[] | Record<string, Step>, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __parallel: stepsOrDict, __hooks: hooks } as any);
      return builder;
    },
    
    // Conditional branching
    branch(condition: (history: StepResult[]) => boolean, branches: { true: (agent: AgentBuilder) => AgentBuilder; false: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __branch: { condition, branches }, __hooks: hooks } as any);
      return builder;
    },
    
    switch<T = string>(selector: (history: StepResult[]) => T, cases: Record<string, (agent: AgentBuilder) => AgentBuilder> & { default?: (agent: AgentBuilder) => AgentBuilder }, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __switch: { selector, cases }, __hooks: hooks } as any);
      return builder;
    },
    
    // Loops
    while(condition: (history: StepResult[]) => boolean, body: (agent: AgentBuilder) => AgentBuilder, opts?: { maxIterations?: number; timeout?: number; pre?: () => void; post?: () => void }) {
      steps.push({ __while: { condition, body, opts } } as any);
      return builder;
    },
    
    forEach<T>(items: T[], body: (item: T, agent: AgentBuilder) => AgentBuilder, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __forEach: { items, body }, __hooks: hooks } as any);
      return builder;
    },
    
    retryUntil(body: (agent: AgentBuilder) => AgentBuilder, successCondition: (result: StepResult) => boolean, opts?: { maxAttempts?: number; backoff?: number; pre?: () => void; post?: () => void }) {
      steps.push({ __retryUntil: { body, successCondition, opts } } as any);
      return builder;
    },
    
    // Sub-agent composition
    runAgent(subAgent: AgentBuilder, hooks?: { pre?: () => void; post?: () => void }) {
      steps.push({ __runAgent: { subAgent }, __hooks: hooks } as any);
      return builder;
    },
    
    async run(log?: (s: StepResult, stepIndex: number) => void): Promise<StepResult[]> {
      if (isRunning) {
        throw new AgentConcurrencyError('This agent is already running. Create a new agent() instance for concurrent runs.');
      }
      isRunning = true;
      
      const isSubAgent = (builder as any).__isSubAgent || false;
      const isExplicitSubAgent = (builder as any).__isExplicitSubAgent || false;
      const parentStepIndex = (builder as any).__parentStepIndex;
      const parentTotalSteps = (builder as any).__parentTotalSteps;
      const parentAgentName = (builder as any).__parentAgentName;
      const progress = showProgress ? createProgressHandler(steps.length, isSubAgent, isExplicitSubAgent, parentStepIndex, parentTotalSteps) : null;
      
      // Record agent execution (always, even for anonymous agents)
      if (telemetry) {
        telemetry.recordMetric('agent.execution', 1, {
          agent_name: agentName || 'anonymous',
          parent_agent: parentAgentName || 'none',
          is_subagent: isSubAgent.toString()
        });
      }
      
      // Start agent span
      const agentSpan = telemetry?.startAgentSpan(steps.length, agentName) || null;
      const out: StepResult[] = [];
      
      // Inherit parent context if this is a subagent
      if (!inheritedParentContext && (builder as any).__parentContext) {
        contextHistory = [...(builder as any).__parentContext];
        inheritedParentContext = true;
      }
      
      try {
        // snapshot steps array to make run isolated from later .then() calls
        const planned = [...steps];
        for (const raw of planned) {
          if ((raw as any).__reset) { contextHistory = []; continue; }
          
          // Handle advanced pattern steps
          if ((raw as any).__parallel) {
            const hooks = (raw as any).__hooks;
            safeExecuteHook(hooks?.pre, 'Pre-parallel');
            
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
            
            safeExecuteHook(hooks?.post, 'Post-parallel');
            continue;
          }
          
          if ((raw as any).__branch) {
            const { condition, branches } = (raw as any).__branch;
            const hooks = (raw as any).__hooks;
            safeExecuteHook(hooks?.pre, 'Pre-branch');
            
            const branchResults = await executeBranch(condition, branches, out, () => agent(opts));
            out.push(...branchResults);
            contextHistory.push(...branchResults);
            branchResults.forEach((r, i) => log?.(r, out.length - branchResults.length + i));
            
            safeExecuteHook(hooks?.post, 'Post-branch');
            continue;
          }
          
          if ((raw as any).__switch) {
            const { selector, cases } = (raw as any).__switch;
            const hooks = (raw as any).__hooks;
            safeExecuteHook(hooks?.pre, 'Pre-switch');
            
            const switchResults = await executeSwitch(selector, cases, out, () => agent(opts));
            out.push(...switchResults);
            contextHistory.push(...switchResults);
            switchResults.forEach((r, i) => log?.(r, out.length - switchResults.length + i));
            
            safeExecuteHook(hooks?.post, 'Post-switch');
            continue;
          }
          
          if ((raw as any).__while) {
            const { condition, body, opts: whileOpts } = (raw as any).__while;
            safeExecuteHook(whileOpts?.pre, 'Pre-while');
            
            const whileResults = await executeWhile(condition, body, out, () => agent(opts), whileOpts);
            out.push(...whileResults);
            contextHistory.push(...whileResults);
            whileResults.forEach((r, i) => log?.(r, out.length - whileResults.length + i));
            
            safeExecuteHook(whileOpts?.post, 'Post-while');
            continue;
          }
          
          if ((raw as any).__forEach) {
            const { items, body } = (raw as any).__forEach;
            const hooks = (raw as any).__hooks;
            safeExecuteHook(hooks?.pre, 'Pre-forEach');
            
            const forEachResults = await executeForEach(items, body, () => agent(opts));
            out.push(...forEachResults);
            contextHistory.push(...forEachResults);
            forEachResults.forEach((r, i) => log?.(r, out.length - forEachResults.length + i));
            
            safeExecuteHook(hooks?.post, 'Post-forEach');
            continue;
          }
          
          if ((raw as any).__retryUntil) {
            const { body, successCondition, opts: retryOpts } = (raw as any).__retryUntil;
            safeExecuteHook(retryOpts?.pre, 'Pre-retryUntil');
            
            const retryResults = await executeRetryUntil(body, successCondition, () => agent(opts), retryOpts);
            out.push(...retryResults);
            contextHistory.push(...retryResults);
            retryResults.forEach((r, i) => log?.(r, out.length - retryResults.length + i));
            
            safeExecuteHook(retryOpts?.post, 'Post-retryUntil');
            continue;
          }
          
          if ((raw as any).__runAgent) {
            const { subAgent } = (raw as any).__runAgent;
            const hooks = (raw as any).__hooks;
            safeExecuteHook(hooks?.pre, 'Pre-runAgent');
            
            // Pass parent's context to subagent
            const subResults = await executeRunAgent(subAgent, out.length, planned.length, contextHistory);
            out.push(...subResults);
            contextHistory.push(...subResults);
            subResults.forEach((r, i) => log?.(r, out.length - subResults.length + i));
            
            safeExecuteHook(hooks?.post, 'Post-runAgent');
            continue;
          }
          
          const s = typeof raw === 'function' ? (raw as StepFactory)(out) : (raw as Step);
          const stepTimeoutMs = ((s as any).timeout ?? (defaultTimeoutMs / 1000)) * 1000;
          const retryCfg: RetryConfig = (s as any).retry ?? defaultRetry;
          const attemptsTotal = retryCfg.retries ?? defaultRetry.retries ?? CONSTANTS.DEFAULT_RETRY_ATTEMPTS;
          const useDelay = retryCfg.delay ?? defaultRetry.delay ?? CONSTANTS.DEFAULT_RETRY_DELAY_SECONDS;
          const useBackoff = retryCfg.backoff;
          if (useDelay && useBackoff) throw new Error('retry: specify either delay or backoff, not both');
  
          const doStep = async (): Promise<StepResult> => {
            safeExecuteHook((s as any).pre, 'Pre-step');
            
            // Determine step type for telemetry
            let stepType = 'unknown';
            if ("agents" in s) stepType = 'agent_crew';
            else if ("mcps" in s) stepType = 'mcp_auto';
            else if ("mcp" in s) stepType = 'mcp_explicit';
            else if ("prompt" in s) stepType = 'llm';
            
            // Start step span
            const stepPrompt = (s as any).prompt;
            const stepName = (s as any).name;
            const stepLlm = (s as any).llm || defaultLlm;
            const stepSpan = telemetry?.startStepSpan(agentSpan, out.length, stepType, stepPrompt, stepName, stepLlm) || null;
            
            const r: StepResult = {};
            const stepStart = Date.now();
            if (progress) progress.stepStart(out.length, (s as any).prompt);
            let llmTotalMs = 0;
            
            // Automatic tool selection with iterative tool calls
            if ("mcps" in s && "prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
              r.prompt = (s as any).prompt;
              // Apply agent-level auth to all MCP handles
              const mcpsWithAuth = ((s as any).mcps as MCPHandle[]).map(applyAgentAuth);
              const availableTools = await discoverTools(mcpsWithAuth);
              if (availableTools.length === 0) {
                r.llmOutput = "No tools available for this request.";
              } else {
                const aggregated: Array<{ name: string; endpoint: string; result: any; ms?: number }> = [];
                const maxIterations = (s as any).maxToolIterations ?? defaultMaxToolIterations;
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
                  const llmCallDuration = Date.now() - llmStart;
                  llmTotalMs += llmCallDuration;
                  
                  telemetry?.recordMetric('llm.call', 1, { provider: getLLMProviderId(usedLlm), error: false });
                  telemetry?.recordMetric('llm.duration', llmCallDuration, { provider: getLLMProviderId(usedLlm), model: usedLlm.model });
                  
                  const usage = (usedLlm as any).getUsage?.();
                  recordTokenMetrics(telemetry, usage, {
                    provider: getLLMProviderId(usedLlm),
                    model: usedLlm.model,
                    agent_name: agentName
                  });
                  
                  if (!toolPlan || !Array.isArray(toolPlan.toolCalls) || toolPlan.toolCalls.length === 0) {
                    // finish with final content
                    r.llmOutput = toolPlan?.content || r.llmOutput;
                    break;
                  }
                  // Execute tools sequentially and append results to prompt for the next iteration
                  let toolResultsAppend = "\n\n[Tool results]\n";
                  for (const call of toolPlan.toolCalls) {
                    const mapped = call;
                    let handle = mapped?.mcpHandle;
                    if (!handle) continue;
                    // Apply agent-level auth
                    handle = applyAgentAuth(handle);
                    // Validate args when schema known
                    try { validateWithSchema((availableTools.find(t => t.name === mapped.name) as any)?.parameters, mapped.arguments, `Tool ${mapped.name}`); } catch (e) { throw e; }
                    const idx = mapped.name.indexOf('.');
                    const actualToolName = idx >= 0 ? mapped.name.slice(idx + 1) : mapped.name;
                    const mcpStart = Date.now();
                    let result: any;
                    try {
                      result = await withMCP(handle, (c) => c.callTool({ name: actualToolName, arguments: mapped.arguments || {} }), telemetry, 'call_tool');
                    } catch (e) {
                      const provider = classifyProviderFromMcp(handle);
                      throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
                    }
                    const mcpMs = Date.now() - mcpStart;
                    const toolCall: any = { name: mapped.name, arguments: mapped.arguments, endpoint: handle.url, result, ms: mcpMs };
                    aggregated.push(toolCall);
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
            // ============================================================================
            // STEP TYPE 2: Automatic Agent Delegation (agents + prompt)
            // Coordinator LLM selects and delegates to specialized agents
            // ============================================================================
            else if ("agents" in s && "prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
              r.prompt = (s as any).prompt;
              
              const availableAgents = (s as any).agents as AgentBuilder[];
              if (availableAgents.length === 0 || !availableAgents.some(a => a.name && a.description)) {
                r.llmOutput = "No agents available or agents missing name/description.";
              } else {
                const agentContext = buildAgentContext(availableAgents);
                const maxIterations = (s as any).maxAgentIterations ?? defaultMaxToolIterations;
                let workingPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory + agentContext;
                const agentCalls: Array<{ name: string; task: string; result: string }> = [];
                let totalTokens = 0;
                const modelsUsed = new Set<string>();
                
                for (let i = 0; i < maxIterations; i++) {
                  // Show coordinator thinking
                  if (progress) {
                    if (i === 0) {
                      process.stdout.write('\n🧠 Coordinator selecting agents...\n');
                      process.stdout.write("   ⏳ Waiting for LLM..");
                    } else {
                      process.stdout.write('🧠 Coordinator deciding next step...\n');
                      process.stdout.write("   ⏳ Waiting for LLM..");
                    }
                    progress.startLlmOperation();
                  }
                  
                  const llmStart = Date.now();
                  let coordinatorResponse: string;
                  let coordTokenCount = 0;
                  
                  try {
                    // Use streaming for coordinator when progress enabled
                    if (progress && typeof usedLlm.genStream === 'function') {
                      const tokens: string[] = [];
                      for await (const token of usedLlm.genStream(workingPrompt)) {
                        tokens.push(token);
                        coordTokenCount++;
                        progress.llmToken(coordTokenCount, getLLMProviderId(usedLlm));
                      }
                      coordinatorResponse = tokens.join('');
                    } else {
                      coordinatorResponse = await usedLlm.gen(workingPrompt);
                    }
                  } catch (e) {
                    const provider = classifyProviderFromLlm(usedLlm);
                    throw normalizeError(e, 'llm', { stepId: out.length, provider });
                  }
                  const coordDuration = Date.now() - llmStart;
                  llmTotalMs += coordDuration;
                  
                  const coordUsage = (usedLlm as any).getUsage?.();
                  recordTokenMetrics(telemetry, coordUsage, {
                    provider: getLLMProviderId(usedLlm),
                    model: usedLlm.model,
                    agent_name: agentName || 'coordinator'
                  });
                  
                  const decision = parseAgentDecision(coordinatorResponse);
                  
                  if (decision.type === 'done') {
                    totalTokens += coordTokenCount;
                    modelsUsed.add(getLLMProviderId(usedLlm));
                    if (progress) {
                    const coordTime = (Date.now() - llmStart) / 1000;
                    // Clear token line and coordinator status line, then print decision
                    process.stdout.write('\r\x1b[K');  // Clear token line
                    process.stdout.write('\x1b[1A\r\x1b[K');  // Move up and clear coordinator status line
                    if (i === 0) {
                      process.stdout.write('🧠 Coordinator: Final answer ready\n');
                    } else {
                      process.stdout.write('🧠 Coordinator: Final answer ready\n');
                    }
                    process.stdout.write(`   ✅ Complete | ${coordTokenCount} tokens | ${coordTime.toFixed(1)}s | ${getLLMProviderId(usedLlm)}\n`);
                  }
                    r.llmOutput = decision.answer;
                    break;
                  } else if (decision.type === 'use_agent') {
                    totalTokens += coordTokenCount;
                    modelsUsed.add(getLLMProviderId(usedLlm));
                    if (progress) {
                    const coordTime = (Date.now() - llmStart) / 1000;
                    // Clear token line and coordinator status line, then print decision
                    process.stdout.write('\r\x1b[K');  // Clear token line
                    process.stdout.write('\x1b[1A\r\x1b[K');  // Move up and clear coordinator status line
                    if (i === 0) {
                      process.stdout.write(`🧠 Coordinator decision: USE ${decision.agentName}\n`);
                    } else {
                      process.stdout.write(`🧠 Coordinator decision: USE ${decision.agentName}\n`);
                    }
                    process.stdout.write(`   ✅ Complete | ${coordTokenCount} tokens | ${coordTime.toFixed(1)}s | ${getLLMProviderId(usedLlm)}\n`);
                  }
                    const selectedAgent = availableAgents.find(a => a.name === decision.agentName);
                    if (!selectedAgent) {
                      workingPrompt += `\n\nError: Agent '${decision.agentName}' not found. Available: ${availableAgents.map(a => a.name).join(', ')}`;
                      continue;
                    }
                    
                    if (progress) progress.agentStart(decision.agentName, decision.task);
                    
                    const agentStart = Date.now();
                    let agentResult: StepResult[];
                    let agentTokenCount = 0;
                    
                    try {
                      // Pass onToken to agent for progress tracking
                      const agentStep: any = { prompt: decision.task };
                      if (progress) {
                        agentStep.onToken = () => {
                          agentTokenCount++;
                          progress.agentToken(agentTokenCount, decision.agentName);
                        };
                      }
                      // Mark delegated agent as sub-agent to suppress its progress banner
                      const delegatedAgent = selectedAgent.then(agentStep);
                      (delegatedAgent as any).__isSubAgent = true;
                      (delegatedAgent as any).__parentAgentName = agentName || 'coordinator';
                      
                      // Record sub-agent relationship
                      if (telemetry) {
                        telemetry.recordMetric('agent.subagent_call', 1, {
                          parent_agent_name: agentName || 'coordinator',
                          agent_name: decision.agentName
                        });
                      }
                      
                      agentResult = await delegatedAgent.run();
                    } catch (e) {
                      workingPrompt += `\n\nAgent '${decision.agentName}' failed: ${(e as Error).message}`;
                      continue;
                    }
                    const agentMs = Date.now() - agentStart;
                    
                    totalTokens += agentTokenCount;
                    modelsUsed.add(getLLMProviderId(usedLlm));
                    
                    const agentOutput = agentResult[agentResult.length - 1]?.llmOutput || '[no output]';
                    agentCalls.push({ name: decision.agentName, task: decision.task, result: agentOutput });
                    
                      if (progress) progress.agentComplete(decision.agentName, agentTokenCount, agentMs, getLLMProviderId(usedLlm));
                    
                    workingPrompt += `\n\nAgent '${decision.agentName}' completed (${agentMs}ms):\n${agentOutput}\n\nWhat's next?`;
                  } else {
                    if (i === maxIterations - 1) {
                      r.llmOutput = decision.raw;
                    } else {
                      workingPrompt += `\n\nPlease use the USE or DONE directive.`;
                    }
                  }
                }
                
                if (!r.llmOutput && agentCalls.length > 0) {
                  r.llmOutput = agentCalls[agentCalls.length - 1].result;
                }
                
                if (agentCalls.length > 0) {
                  (r as any).agentCalls = agentCalls;
                  (r as any).__crewTotalTokens = totalTokens;
                  (r as any).__crewModels = Array.from(modelsUsed);
                  telemetry?.recordMetric('agent.delegation', agentCalls.length, { agents: agentCalls.map(c => c.name).join(',') });
                  for (const agentCall of agentCalls) {
                    telemetry?.recordMetric('agent.call', 1, { agentName: agentCall.name });
                  }
                }
              }
            }
            // ============================================================================
            // STEP TYPE 3: LLM-Only Step (prompt without tools/agents)
            // Simple LLM generation with optional streaming
            // ============================================================================
            else if ("prompt" in s && !("mcp" in s) && !("mcps" in s) && !("agents" in s)) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
              const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
              r.prompt = (s as any).prompt;
              const llmSpan = telemetry?.startLLMSpan(stepSpan, usedLlm, finalPrompt) || null;
              if (progress) progress.startLlmOperation();
              const llmStart = Date.now();
              try {
                let tokenCount = 0;
                const customOnToken = (s as any).onToken;
                const progressOnToken = !customOnToken && progress ? () => {
                  tokenCount++;
                      progress.llmToken(tokenCount, getLLMProviderId(usedLlm));
                } : undefined;
                
                r.llmOutput = await executeLLMWithStreaming(
                  usedLlm,
                  finalPrompt,
                  customOnToken || progressOnToken,
                  undefined,
                  { stepIndex: out.length, stepPrompt: (s as any).prompt }
                );
                (r as any).__tokenCount = tokenCount;
                (r as any).__provider = getLLMProviderId(usedLlm);
                    const llmCallDuration = Date.now() - llmStart;
                    telemetry?.endSpan(llmSpan);
                    telemetry?.recordMetric('llm.call', 1, { provider: getLLMProviderId(usedLlm), error: false });
                    telemetry?.recordMetric('llm.duration', llmCallDuration, { provider: getLLMProviderId(usedLlm), model: usedLlm.model });
                
                const usage = (usedLlm as any).getUsage?.();
                recordTokenMetrics(telemetry, usage, {
                  provider: getLLMProviderId(usedLlm),
                  model: usedLlm.model,
                  agent_name: agentName
                });
              } catch (e) {
                telemetry?.endSpan(llmSpan, undefined, e);
                telemetry?.recordMetric('llm.call', 1, { provider: getLLMProviderId(usedLlm), error: true });
                telemetry?.recordMetric('error', 1, { type: 'llm', provider: getLLMProviderId(usedLlm) });
                const provider = classifyProviderFromLlm(usedLlm);
                throw normalizeError(e, 'llm', { stepId: out.length, provider });
              }
              llmTotalMs += Date.now() - llmStart;
            }
            // ============================================================================
            // STEP TYPE 4: Explicit MCP Tool Call (mcp + tool)
            // Direct tool invocation with optional LLM generation first
            // ============================================================================
            else if ("mcp" in s && "tool" in s) {
              // Apply agent-level auth
              const mcpHandle = applyAgentAuth((s as any).mcp);
              
              if ("prompt" in s) {
                const usedLlm = (s as any).llm ?? defaultLlm;
                if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
                const stepInstructions = (s as any).instructions ?? globalInstructions;
                const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
                const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
                const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
                const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
                r.prompt = (s as any).prompt;
                const llmStart = Date.now();
                r.llmOutput = await usedLlm.gen(finalPrompt);
                llmTotalMs += Date.now() - llmStart;
              }
              // Validate against tool schema if discoverable
              const schema = await getToolSchema(mcpHandle, (s as any).tool);
              validateWithSchema(schema, (s as any).args ?? {}, `Tool ${mcpHandle.id}.${(s as any).tool}`);
              const mcpStart = Date.now();
              let res: any;
              try {
                res = await withMCP(mcpHandle, (c) => c.callTool({ name: (s as any).tool, arguments: (s as any).args ?? {} }), telemetry, 'call_tool');
              } catch (e) {
                const provider = classifyProviderFromMcp(mcpHandle);
                throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
              }
              const mcpMs = Date.now() - mcpStart;
              r.mcp = { endpoint: mcpHandle.url, tool: (s as any).tool, result: res, ms: mcpMs };
            }
  
            r.llmMs = llmTotalMs;
            r.durationMs = Date.now() - stepStart;
            
            // End step span
            telemetry?.endSpan(stepSpan, r);
            telemetry?.recordMetric('step.duration', r.durationMs, { type: stepType });
            
            // Flush telemetry after each step for real-time visibility
            await telemetry?.flush();
            
            safeExecuteHook((s as any).post, 'Post-step');
            
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
                const waitMs = CONSTANTS.DEFAULT_RETRY_BACKOFF_BASE_MS * Math.pow(useBackoff, attempt - 1);
                await sleep(waitMs);
              } else {
                const waitMs = Math.max(0, (useDelay ?? 0) * 1000);
                if (waitMs > 0) await sleep(waitMs);
              }
            }
          }
        if (!result) throw (lastError instanceof VolcanoError ? lastError : new RetryExhaustedError('Retry attempts exhausted', { stepId: out.length }, { cause: lastError }));
  
          const r = result;
          if (progress) {
            const crewTokens = (r as any).__crewTotalTokens;
            const crewModels = (r as any).__crewModels;
            progress.stepComplete(r.durationMs || 0, (r as any).__tokenCount, (r as any).__provider, crewTokens, crewModels);
          }
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
          
          // End agent span and record metrics
          telemetry?.endSpan(agentSpan, last);
          telemetry?.recordMetric('agent.duration', totalDuration, { steps: out.length });
          telemetry?.recordMetric('workflow.steps', out.length, { agent_name: agentName || 'anonymous' });
        }
        return out;
      } catch (error) {
        // End agent span with error
        telemetry?.endSpan(agentSpan, undefined, error);
        telemetry?.recordMetric('error', 1, { type: 'agent', level: 'workflow' });
        throw error;
      } finally {
        if (progress) {
          // Calculate totals for workflow end
          const totalTokens = out.reduce((acc, s) => {
            const stepTokens = (s as any).__tokenCount || (s as any).__crewTotalTokens || 0;
            return acc + stepTokens;
          }, 0);
          const modelsUsed = new Set<string>();
          out.forEach(s => {
            const provider = (s as any).__provider;
            const crewModels = (s as any).__crewModels;
            if (provider) modelsUsed.add(provider);
            if (crewModels) crewModels.forEach((m: string) => modelsUsed.add(m));
          });
          const totalDuration = out.reduce((acc, s) => acc + (s.durationMs || 0), 0);
          progress.workflowEnd(steps.length, totalTokens, totalDuration, Array.from(modelsUsed));
        }
        isRunning = false;
      }
    },
    async *stream(optionsOrLog?: StreamOptions | ((s: StepResult, stepIndex: number) => void)): AsyncGenerator<StepResult, void, unknown> {
      if (isRunning) {
        throw new AgentConcurrencyError('This agent is already running. Create a new agent() instance for concurrent runs.');
      }
      isRunning = true;
      
      const isSubAgent = (builder as any).__isSubAgent || false;
      const isExplicitSubAgent = (builder as any).__isExplicitSubAgent || false;
      const parentStepIndex = (builder as any).__parentStepIndex;
      const parentTotalSteps = (builder as any).__parentTotalSteps;
      const progress = showProgress ? createProgressHandler(steps.length, isSubAgent, isExplicitSubAgent, parentStepIndex, parentTotalSteps) : null;
      
      // Parse options for backward compatibility
      let streamOnToken: ((token: string, meta: TokenMetadata) => void) | undefined;
      let log: ((s: StepResult, stepIndex: number) => void) | undefined;
      
      if (typeof optionsOrLog === 'function') {
        // Old API: stream(callback)
        log = optionsOrLog;
      } else if (optionsOrLog) {
        // New API: stream({ onToken, onStep })
        streamOnToken = optionsOrLog.onToken;
        log = optionsOrLog.onStep;
      }
      
      // Start agent span
      const agentSpan = telemetry?.startAgentSpan(steps.length, agentName) || null;
      const out: StepResult[] = [];
      
      // Inherit parent context if this is a subagent
      if (!inheritedParentContext && (builder as any).__parentContext) {
        contextHistory = [...(builder as any).__parentContext];
        inheritedParentContext = true;
      }
      
      // Capture streamOnToken from stream() context for use in doStep
      const capturedStreamOnToken = streamOnToken;
      
      try {
        // snapshot steps array to make run isolated from later .then() calls
        const planned = [...steps];
        for (const raw of planned) {
          if ((raw as any).__reset) { contextHistory = []; continue; }
          
          // Handle advanced pattern steps (same as run() with hooks)
          if ((raw as any).__parallel) {
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for parallel:', e); }
            
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
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for parallel:', e); }
            continue;
          }
          
          if ((raw as any).__branch) {
            const { condition, branches } = (raw as any).__branch;
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for branch:', e); }
            
            const branchResults = await executeBranch(condition, branches, out, () => agent(opts));
            out.push(...branchResults);
            contextHistory.push(...branchResults);
            for (const r of branchResults) {
              log?.(r, out.length - branchResults.length + branchResults.indexOf(r));
              yield r;
            }
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for branch:', e); }
            continue;
          }
          
          if ((raw as any).__switch) {
            const { selector, cases } = (raw as any).__switch;
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for switch:', e); }
            
            const switchResults = await executeSwitch(selector, cases, out, () => agent(opts));
            out.push(...switchResults);
            contextHistory.push(...switchResults);
            for (const r of switchResults) {
              log?.(r, out.length - switchResults.length + switchResults.indexOf(r));
              yield r;
            }
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for switch:', e); }
            continue;
          }
          
          if ((raw as any).__while) {
            const { condition, body, opts: whileOpts } = (raw as any).__while;
            try { whileOpts?.pre?.(); } catch (e) { console.warn('Pre-hook failed for while:', e); }
            
            const whileResults = await executeWhile(condition, body, out, () => agent(opts), whileOpts);
            out.push(...whileResults);
            contextHistory.push(...whileResults);
            for (const r of whileResults) {
              log?.(r, out.length - whileResults.length + whileResults.indexOf(r));
              yield r;
            }
            
            try { whileOpts?.post?.(); } catch (e) { console.warn('Post-hook failed for while:', e); }
            continue;
          }
          
          if ((raw as any).__forEach) {
            const { items, body } = (raw as any).__forEach;
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for forEach:', e); }
            
            const forEachResults = await executeForEach(items, body, () => agent(opts));
            out.push(...forEachResults);
            contextHistory.push(...forEachResults);
            for (const r of forEachResults) {
              log?.(r, out.length - forEachResults.length + forEachResults.indexOf(r));
              yield r;
            }
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for forEach:', e); }
            continue;
          }
          
          if ((raw as any).__retryUntil) {
            const { body, successCondition, opts: retryOpts } = (raw as any).__retryUntil;
            try { retryOpts?.pre?.(); } catch (e) { console.warn('Pre-hook failed for retryUntil:', e); }
            
            const retryResults = await executeRetryUntil(body, successCondition, () => agent(opts), retryOpts);
            out.push(...retryResults);
            contextHistory.push(...retryResults);
            for (const r of retryResults) {
              log?.(r, out.length - retryResults.length + retryResults.indexOf(r));
              yield r;
            }
            
            try { retryOpts?.post?.(); } catch (e) { console.warn('Post-hook failed for retryUntil:', e); }
            continue;
          }
          
          if ((raw as any).__runAgent) {
            const { subAgent } = (raw as any).__runAgent;
            const hooks = (raw as any).__hooks;
            try { hooks?.pre?.(); } catch (e) { console.warn('Pre-hook failed for runAgent:', e); }
            
            // Pass parent's context to subagent
            const subResults = await executeRunAgent(subAgent, out.length, planned.length, contextHistory);
            out.push(...subResults);
            contextHistory.push(...subResults);
            for (const r of subResults) {
              log?.(r, out.length - subResults.length + subResults.indexOf(r));
              yield r;
            }
            
            try { hooks?.post?.(); } catch (e) { console.warn('Post-hook failed for runAgent:', e); }
            continue;
          }
          
          const s = typeof raw === 'function' ? (raw as StepFactory)(out) : (raw as Step);
          const stepTimeoutMs = ((s as any).timeout ?? (defaultTimeoutMs / 1000)) * 1000;
          const retryCfg: RetryConfig = (s as any).retry ?? defaultRetry;
          const attemptsTotal = retryCfg.retries ?? defaultRetry.retries ?? CONSTANTS.DEFAULT_RETRY_ATTEMPTS;
          const useDelay = retryCfg.delay ?? defaultRetry.delay ?? CONSTANTS.DEFAULT_RETRY_DELAY_SECONDS;
          const useBackoff = retryCfg.backoff;
          if (useDelay && useBackoff) throw new Error('retry: specify either delay or backoff, not both');
  
          const doStep = async (): Promise<StepResult> => {
            safeExecuteHook((s as any).pre, 'Pre-step');
            
            // Determine step type for telemetry
            let stepType = 'unknown';
            if ("agents" in s) stepType = 'agent_crew';
            else if ("mcps" in s) stepType = 'mcp_auto';
            else if ("mcp" in s) stepType = 'mcp_explicit';
            else if ("prompt" in s) stepType = 'llm';
            
            // Start step span
            const stepPrompt = (s as any).prompt;
            const stepName = (s as any).name;
            const stepLlm = (s as any).llm || defaultLlm;
            const stepSpan = telemetry?.startStepSpan(agentSpan, out.length, stepType, stepPrompt, stepName, stepLlm) || null;
            
            const r: StepResult = {};
            const stepStart = Date.now();
            let llmTotalMs = 0;
            
            // ============================================================================
            // STEP TYPE 1: Automatic Tool Selection (mcps + prompt)
            // Iteratively calls LLM with tools until it returns a final answer
            // ============================================================================
            if ("mcps" in s && "prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
              r.prompt = (s as any).prompt;
              // Apply agent-level auth to all MCP handles
              const mcpsWithAuth = ((s as any).mcps as MCPHandle[]).map(applyAgentAuth);
              const availableTools = await discoverTools(mcpsWithAuth);
              if (availableTools.length === 0) {
                r.llmOutput = "No tools available for this request.";
              } else {
                const aggregated: Array<{ name: string; endpoint: string; result: any; ms?: number }> = [];
                const maxIterations = (s as any).maxToolIterations ?? defaultMaxToolIterations;
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
                  const llmCallDuration = Date.now() - llmStart;
                  llmTotalMs += llmCallDuration;
                  
                  telemetry?.recordMetric('llm.call', 1, { provider: getLLMProviderId(usedLlm), error: false });
                  telemetry?.recordMetric('llm.duration', llmCallDuration, { provider: getLLMProviderId(usedLlm), model: usedLlm.model });
                  
                  const usage = (usedLlm as any).getUsage?.();
                  recordTokenMetrics(telemetry, usage, {
                    provider: getLLMProviderId(usedLlm),
                    model: usedLlm.model,
                    agent_name: agentName
                  });
                  
                  if (!toolPlan || !Array.isArray(toolPlan.toolCalls) || toolPlan.toolCalls.length === 0) {
                    // finish with final content
                    r.llmOutput = toolPlan?.content || r.llmOutput;
                    break;
                  }
                  // Execute tools sequentially and append results to prompt for the next iteration
                  let toolResultsAppend = "\n\n[Tool results]\n";
                  for (const call of toolPlan.toolCalls) {
                    const mapped = call;
                    let handle = mapped?.mcpHandle;
                    if (!handle) continue;
                    // Apply agent-level auth
                    handle = applyAgentAuth(handle);
                    // Validate args when schema known
                    try { validateWithSchema((availableTools.find(t => t.name === mapped.name) as any)?.parameters, mapped.arguments, `Tool ${mapped.name}`); } catch (e) { throw e; }
                    const idx = mapped.name.indexOf('.');
                    const actualToolName = idx >= 0 ? mapped.name.slice(idx + 1) : mapped.name;
                    const mcpStart = Date.now();
                    let result: any;
                    try {
                      result = await withMCP(handle, (c) => c.callTool({ name: actualToolName, arguments: mapped.arguments || {} }), telemetry, 'call_tool');
                    } catch (e) {
                      const provider = classifyProviderFromMcp(handle);
                      throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
                    }
                    const mcpMs = Date.now() - mcpStart;
                    const toolCall: any = { name: mapped.name, arguments: mapped.arguments, endpoint: handle.url, result, ms: mcpMs };
                    aggregated.push(toolCall);
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
            // ============================================================================
            // STEP TYPE 2: Automatic Agent Delegation (agents + prompt)
            // Coordinator LLM selects and delegates to specialized agents
            // ============================================================================
            else if ("agents" in s && "prompt" in s) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
              r.prompt = (s as any).prompt;
              
              const availableAgents = (s as any).agents as AgentBuilder[];
              if (availableAgents.length === 0 || !availableAgents.some(a => a.name && a.description)) {
                r.llmOutput = "No agents available or agents missing name/description.";
              } else {
                const agentContext = buildAgentContext(availableAgents);
                const maxIterations = (s as any).maxAgentIterations ?? defaultMaxToolIterations;
                let workingPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory + agentContext;
                const agentCalls: Array<{ name: string; task: string; result: string }> = [];
                let totalTokens = 0;
                const modelsUsed = new Set<string>();
                
                for (let i = 0; i < maxIterations; i++) {
                  // Show coordinator thinking
                  if (progress) {
                    if (i === 0) {
                      process.stdout.write('\n🧠 Coordinator selecting agents...\n');
                      process.stdout.write("   ⏳ Waiting for LLM..");
                    } else {
                      process.stdout.write('🧠 Coordinator deciding next step...\n');
                      process.stdout.write("   ⏳ Waiting for LLM..");
                    }
                    progress.startLlmOperation();
                  }
                  
                  const llmStart = Date.now();
                  let coordinatorResponse: string;
                  let coordTokenCount = 0;
                  
                  try {
                    // Use streaming for coordinator when progress enabled
                    if (progress && typeof usedLlm.genStream === 'function') {
                      const tokens: string[] = [];
                      for await (const token of usedLlm.genStream(workingPrompt)) {
                        tokens.push(token);
                        coordTokenCount++;
                        progress.llmToken(coordTokenCount, getLLMProviderId(usedLlm));
                      }
                      coordinatorResponse = tokens.join('');
                    } else {
                      coordinatorResponse = await usedLlm.gen(workingPrompt);
                    }
                  } catch (e) {
                    const provider = classifyProviderFromLlm(usedLlm);
                    throw normalizeError(e, 'llm', { stepId: out.length, provider });
                  }
                  const coordDuration = Date.now() - llmStart;
                  llmTotalMs += coordDuration;
                  
                  const coordUsage = (usedLlm as any).getUsage?.();
                  recordTokenMetrics(telemetry, coordUsage, {
                    provider: getLLMProviderId(usedLlm),
                    model: usedLlm.model,
                    agent_name: agentName || 'coordinator'
                  });
                  
                  const decision = parseAgentDecision(coordinatorResponse);
                  
                  if (decision.type === 'done') {
                    totalTokens += coordTokenCount;
                    modelsUsed.add(getLLMProviderId(usedLlm));
                    if (progress) {
                    const coordTime = (Date.now() - llmStart) / 1000;
                    // Clear token line and coordinator status line, then print decision
                    process.stdout.write('\r\x1b[K');  // Clear token line
                    process.stdout.write('\x1b[1A\r\x1b[K');  // Move up and clear coordinator status line
                    if (i === 0) {
                      process.stdout.write('🧠 Coordinator: Final answer ready\n');
                    } else {
                      process.stdout.write('🧠 Coordinator: Final answer ready\n');
                    }
                    process.stdout.write(`   ✅ Complete | ${coordTokenCount} tokens | ${coordTime.toFixed(1)}s | ${getLLMProviderId(usedLlm)}\n`);
                  }
                    r.llmOutput = decision.answer;
                    break;
                  } else if (decision.type === 'use_agent') {
                    totalTokens += coordTokenCount;
                    modelsUsed.add(getLLMProviderId(usedLlm));
                    if (progress) {
                    const coordTime = (Date.now() - llmStart) / 1000;
                    // Clear token line and coordinator status line, then print decision
                    process.stdout.write('\r\x1b[K');  // Clear token line
                    process.stdout.write('\x1b[1A\r\x1b[K');  // Move up and clear coordinator status line
                    if (i === 0) {
                      process.stdout.write(`🧠 Coordinator decision: USE ${decision.agentName}\n`);
                    } else {
                      process.stdout.write(`🧠 Coordinator decision: USE ${decision.agentName}\n`);
                    }
                    process.stdout.write(`   ✅ Complete | ${coordTokenCount} tokens | ${coordTime.toFixed(1)}s | ${getLLMProviderId(usedLlm)}\n`);
                  }
                    const selectedAgent = availableAgents.find(a => a.name === decision.agentName);
                    if (!selectedAgent) {
                      workingPrompt += `\n\nError: Agent '${decision.agentName}' not found. Available: ${availableAgents.map(a => a.name).join(', ')}`;
                      continue;
                    }
                    
                    if (progress) progress.agentStart(decision.agentName, decision.task);
                    
                    const agentStart = Date.now();
                    let agentResult: StepResult[];
                    let agentTokenCount = 0;
                    
                    try {
                      // Pass onToken to agent for progress tracking
                      const agentStep: any = { prompt: decision.task };
                      if (progress) {
                        agentStep.onToken = () => {
                          agentTokenCount++;
                          progress.agentToken(agentTokenCount, decision.agentName);
                        };
                      }
                      // Mark delegated agent as sub-agent to suppress its progress banner
                      const delegatedAgent = selectedAgent.then(agentStep);
                      (delegatedAgent as any).__isSubAgent = true;
                      (delegatedAgent as any).__parentAgentName = agentName || 'coordinator';
                      
                      // Record sub-agent relationship
                      if (telemetry) {
                        telemetry.recordMetric('agent.subagent_call', 1, {
                          parent_agent_name: agentName || 'coordinator',
                          agent_name: decision.agentName
                        });
                      }
                      
                      agentResult = await delegatedAgent.run();
                    } catch (e) {
                      workingPrompt += `\n\nAgent '${decision.agentName}' failed: ${(e as Error).message}`;
                      continue;
                    }
                    const agentMs = Date.now() - agentStart;
                    
                    totalTokens += agentTokenCount;
                    modelsUsed.add(getLLMProviderId(usedLlm));
                    
                    const agentOutput = agentResult[agentResult.length - 1]?.llmOutput || '[no output]';
                    agentCalls.push({ name: decision.agentName, task: decision.task, result: agentOutput });
                    
                      if (progress) progress.agentComplete(decision.agentName, agentTokenCount, agentMs, getLLMProviderId(usedLlm));
                    
                    workingPrompt += `\n\nAgent '${decision.agentName}' completed (${agentMs}ms):\n${agentOutput}\n\nWhat's next?`;
                  } else {
                    if (i === maxIterations - 1) {
                      r.llmOutput = decision.raw;
                    } else {
                      workingPrompt += `\n\nPlease use the USE or DONE directive.`;
                    }
                  }
                }
                
                if (!r.llmOutput && agentCalls.length > 0) {
                  r.llmOutput = agentCalls[agentCalls.length - 1].result;
                }
                
                if (agentCalls.length > 0) {
                  (r as any).agentCalls = agentCalls;
                  (r as any).__crewTotalTokens = totalTokens;
                  (r as any).__crewModels = Array.from(modelsUsed);
                  telemetry?.recordMetric('agent.delegation', agentCalls.length, { agents: agentCalls.map(c => c.name).join(',') });
                  for (const agentCall of agentCalls) {
                    telemetry?.recordMetric('agent.call', 1, { agentName: agentCall.name });
                  }
                }
              }
            }
            // ============================================================================
            // STEP TYPE 3: LLM-Only Step (prompt without tools/agents)
            // Simple LLM generation with optional streaming
            // ============================================================================
            else if ("prompt" in s && !("mcp" in s) && !("mcps" in s) && !("agents" in s)) {
              const usedLlm = (s as any).llm ?? defaultLlm;
              if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
              const stepInstructions = (s as any).instructions ?? globalInstructions;
              const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
              const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
              const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
              const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
              r.prompt = (s as any).prompt;
              const llmSpan = telemetry?.startLLMSpan(stepSpan, usedLlm, finalPrompt) || null;
              const llmStart = Date.now();
              try {
                r.llmOutput = await executeLLMWithStreaming(
                  usedLlm,
                  finalPrompt,
                  (s as any).onToken,
                  capturedStreamOnToken,
                  { stepIndex: out.length, stepPrompt: (s as any).prompt }
                );
                    const llmCallDuration = Date.now() - llmStart;
                    telemetry?.endSpan(llmSpan);
                    telemetry?.recordMetric('llm.call', 1, { provider: getLLMProviderId(usedLlm), error: false });
                    telemetry?.recordMetric('llm.duration', llmCallDuration, { provider: getLLMProviderId(usedLlm), model: usedLlm.model });
              } catch (e) {
                telemetry?.endSpan(llmSpan, undefined, e);
                telemetry?.recordMetric('llm.call', 1, { provider: getLLMProviderId(usedLlm), error: true });
                telemetry?.recordMetric('error', 1, { type: 'llm', provider: getLLMProviderId(usedLlm) });
                const provider = classifyProviderFromLlm(usedLlm);
                throw normalizeError(e, 'llm', { stepId: out.length, provider });
              }
              llmTotalMs += Date.now() - llmStart;
            }
            // ============================================================================
            // STEP TYPE 4: Explicit MCP Tool Call (mcp + tool)
            // Direct tool invocation with optional LLM generation first
            // ============================================================================
            else if ("mcp" in s && "tool" in s) {
              // Apply agent-level auth
              const mcpHandle = applyAgentAuth((s as any).mcp);
              
              if ("prompt" in s) {
                const usedLlm = (s as any).llm ?? defaultLlm;
                if (!usedLlm) throw new Error("No LLM provided. Pass { llm } to agent(...) or specify per-step.");
                const stepInstructions = (s as any).instructions ?? globalInstructions;
                const maxToolResults = (s as any).contextMaxToolResults ?? contextMaxToolResults;
                const maxContextChars = (s as any).contextMaxChars ?? contextMaxChars;
                const promptWithHistory = (s as any).prompt + buildHistoryContextChunked(contextHistory, maxToolResults, maxContextChars);
                const finalPrompt = (stepInstructions ? stepInstructions + "\n\n" : "") + promptWithHistory;
                r.prompt = (s as any).prompt;
                const llmStart = Date.now();
                r.llmOutput = await usedLlm.gen(finalPrompt);
                llmTotalMs += Date.now() - llmStart;
              }
              // Validate against tool schema if discoverable
              const schema = await getToolSchema(mcpHandle, (s as any).tool);
              validateWithSchema(schema, (s as any).args ?? {}, `Tool ${mcpHandle.id}.${(s as any).tool}`);
              const mcpStart = Date.now();
              let res: any;
              try {
                res = await withMCP(mcpHandle, (c) => c.callTool({ name: (s as any).tool, arguments: (s as any).args ?? {} }), telemetry, 'call_tool');
              } catch (e) {
                const provider = classifyProviderFromMcp(mcpHandle);
                throw normalizeError(e, 'mcp-tool', { stepId: out.length, provider });
              }
              const mcpMs = Date.now() - mcpStart;
              r.mcp = { endpoint: mcpHandle.url, tool: (s as any).tool, result: res, ms: mcpMs };
            }
  
            r.llmMs = llmTotalMs;
            r.durationMs = Date.now() - stepStart;
            
            // End step span
            telemetry?.endSpan(stepSpan, r);
            telemetry?.recordMetric('step.duration', r.durationMs, { type: stepType });
            
            // Flush telemetry after each step for real-time visibility
            await telemetry?.flush();
            
            safeExecuteHook((s as any).post, 'Post-step');
            
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
                const waitMs = CONSTANTS.DEFAULT_RETRY_BACKOFF_BASE_MS * Math.pow(useBackoff, attempt - 1);
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
        if (progress) {
          // Calculate totals for workflow end
          const totalTokens = out.reduce((acc, s) => {
            const stepTokens = (s as any).__tokenCount || (s as any).__crewTotalTokens || 0;
            return acc + stepTokens;
          }, 0);
          const modelsUsed = new Set<string>();
          out.forEach(s => {
            const provider = (s as any).__provider;
            const crewModels = (s as any).__crewModels;
            if (provider) modelsUsed.add(provider);
            if (crewModels) crewModels.forEach((m: string) => modelsUsed.add(m));
          });
          const totalDuration = out.reduce((acc, s) => acc + (s.durationMs || 0), 0);
          progress.workflowEnd(steps.length, totalTokens, totalDuration, Array.from(modelsUsed));
        }
        isRunning = false;
      }
    },
  };
  
  return builder;
}
