[![CI](https://github.com/Kong/volcano-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Kong/volcano-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/volcano-sdk.svg)](https://www.npmjs.com/package/volcano-sdk)

# 🌋 Volcano SDK

Build AI agents that seamlessly combine LLM reasoning with real-world actions via MCP tools — in just a few lines of TypeScript.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start-hello-world)
- [Supported Providers](#supported-providers)
- [Why Volcano SDK](#why-volcano-sdk)
- [Advanced Workflow Patterns](#advanced-workflow-patterns) 🆕
  - [Parallel Execution](#parallel-execution)
  - [Conditional Branching](#conditional-branching)
  - [Loops](#loops)
  - [Sub-Agent Composition](#sub-agent-composition)
  - [Combined Patterns](#combined-patterns)
- [API Reference](#api-tiny-and-familiar)
- [LLM Providers](#llm-providers)
- [Concurrency & Performance](#concurrency--performance)
- [Errors & Diagnostics](#errors--diagnostics)
- [Examples](#examples-youll-want-to-try)
- [Step Hooks](#step-hooks-prepost-execution)
- [Streaming Workflows](#streaming-workflows)
- [Timeouts](#timeouts)
- [Retries](#retries)
- [Requirements](#requirements)

## Supported Providers

Volcano SDK supports **7 major LLM providers** with full function calling and MCP integration:

✅ OpenAI
✅ Anthropic  
✅ Mistral
✅ Llama
✅ AWS Bedrock
✅ Google Vertex Studio
✅ Azure AI

## Install

```bash
npm install volcano-sdk
npm install @modelcontextprotocol/sdk openai

# For AWS Bedrock support (optional)
npm install @aws-sdk/client-bedrock-runtime @aws-sdk/credential-providers
```

## Quick start (hello world)

```ts
import { agent, llmOpenAI } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});

const results = await agent({ llm })
  .then({ prompt: "Say hello to Marco in one short sentence." })
  .run();

console.log(results[0].llmOutput);
```

Two-step with a sample MCP tool (automatic selection):

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});
const astro = mcp("http://localhost:3211/mcp");

const steps = await agent({ llm })
  .then({
    prompt: "Determine the astrological sign for the birthdate 1993-07-11 using available tools.",
    mcps: [astro]
  })
  .then({
    prompt: "Based on that sign, write a friendly one-line fortune.",
  })
  .run();

console.log(steps[0].toolCalls); // shows tool calls like localhost_3211_mcp.get_sign
console.log(steps[1].llmOutput); // fortune that uses prior step context
```

## Why Volcano SDK

- ⚡️ **Tiny, modern API**: Chain steps with `.then()` and `.run()`
- ✨ **Automatic tool selection**: Let the LLM choose which MCP tools to call
- 🔧 **MCP (Streamable HTTP)**: Works out of the box with MCP servers
- 🧩 **Pluggable LLM providers**: Providers live in `src/llms/` (OpenAI included)
- 🛡 **TypeScript-first**: Strong types with minimal ceremony

## Concurrency & performance

- **Agent lifecycle**: Calling `run()` concurrently on the same agent instance throws. Create separate `agent()` instances to run in parallel.
- **MCP connection pooling**: TCP sessions are pooled per MCP endpoint and reused across steps. Idle connections are evicted automatically.
- **Tool discovery cache**: `listTools()` results are cached per endpoint with a short TTL and invalidated on failures.
- **Validation & safety**: When MCP tools expose JSON Schemas for their inputs, Volcano SDK validates tool arguments before calling the tool and rejects invalid payloads early.
- **Context size limits (tunable)**: To avoid oversized prompts, history context is compacted.
  - Defaults: `contextMaxChars = 20480`, `contextMaxToolResults = 8` (most recent tool results).
  - Override at agent level:
```ts
agent({ llm, contextMaxChars: 40000, contextMaxToolResults: 12 })
```
  - Override per step:
```ts
.then({ prompt: "...", contextMaxChars: 12000, contextMaxToolResults: 4 })
```

## Errors & diagnostics

Volcano surfaces typed errors with rich metadata to help you debug quickly.

- Base type: `VolcanoError` with `meta: { stepId?, provider?, requestId?, retryable? }`
- Common subclasses:
  - `AgentConcurrencyError` (run() called twice)
  - `TimeoutError` (per-step timeout)
  - `ValidationError` (tool args schema failure)
  - `RetryExhaustedError` (final failure after retries)
  - `LLMError` (e.g., OpenAI error)
  - `MCPToolError`, `MCPConnectionError`

Metadata fields:
- `stepId`: 0-based index of the failing step
- `provider`: `llm:<id|model>` or `mcp:<host>`
- `requestId`: upstream provider request id when available
- `retryable`: Volcano’s opinionated hint (true for 429/5xx/timeouts; false for validation/4xx)

Example:
```ts
try {
  await agent({ llm, retry: { backoff: 2, retries: 4 }, timeout: 30 })
    .then({ prompt: 'auto', mcps: [mcp('http://localhost:3211/mcp')] })
    .run();
} catch (err) {
  if (err && typeof err === 'object' && 'meta' in err) {
    const e = err as any; // VolcanoError
    console.error(e.name, e.message, e.meta);
    if (e.meta?.retryable) {
      // maybe enqueue for retry later
    }
  } else {
    console.error(err);
  }
}
```

Retry semantics:
- Immediate (default), delayed, and exponential backoff are supported.
- Non‑retryable errors (like `ValidationError`) abort immediately.
- On retry exhaustion, the last error is thrown (e.g., `LLMError`).

## 60‑Second Quickstart

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});

const astro = mcp("http://localhost:3211/mcp");
const favorites = mcp("http://localhost:3212/mcp");

const results = await agent({ llm })
  .then({
    prompt: "For birthdate 1993-07-11, determine the sign and then my favorite food and drink.",
    mcps: [astro, favorites]
  })
  .run();
```

Multi-provider workflow:

```ts
import { agent, llmOpenAI, llmAnthropic, llmMistral, llmLlama, llmBedrock, mcp } from "volcano-sdk";

const openai = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY! });
const llama = llmLlama({ baseURL: "http://127.0.0.1:11434" });
const bedrock = llmBedrock({ 
  model: "anthropic.claude-sonnet-4-20250514-v1:0",
  region: "us-east-1", 
  accessKeyId: process.env.AWS_ACCESS_KEY_ID! 
});
const vertex = llmVertexStudio({ 
  model: "gemini-2.5-flash-lite",
  apiKey: process.env.GCP_VERTEX_API_KEY! 
});

const astro = mcp("http://localhost:3211/mcp");

await agent()
  .then({ llm: openai, prompt: "Get astrological sign for 1993-07-11", mcps: [astro] })
  .then({ llm: claude, prompt: "Analyze the personality traits of that sign" })
  .then({ llm: mistral, prompt: "Write a creative horoscope in French" })
  .then({ llm: bedrock, prompt: "Translate to Spanish and add cultural context" })
  .then({ llm: vertex, prompt: "Analyze the cultural accuracy" })
  .then({ llm: llama, prompt: "Translate back to English" })
  .run();
```

## Timeouts

- Units are in seconds.
- Default timeout per step is **60s**.
- Override at agent level: `agent({ llm, timeout: 65 })` → 65 seconds.
- Override per step: add `timeout` (seconds) to that step.

```ts
await agent({ llm, timeout: 60 })
  .then({ prompt: "Quick check", timeout: 1 }) // 1 second
  .then({ prompt: "Next step uses agent default" })
  .run();
```

## Retries

- Units are in seconds for `delay` and backoff waits.
- Default retry is **immediate** (`delay: 0`) with `retries: 3`.
- Delayed retry: `agent({ retry: { delay: 20 } })` waits 20s between attempts.
- Exponential backoff: `agent({ retry: { backoff: 2 } })` waits 1s → 2s → 4s → 8s ...
- You cannot set both `delay` and `backoff` at the same time.
- Per-step override via `retry` on the step object.

```ts
// Immediate retry (default)
await agent({ llm })
  .then({ prompt: "hello" })
  .run();

// Delayed retry: wait 20s between attempts
await agent({ llm, retry: { delay: 20, retries: 3 } })
  .then({ prompt: "unstable action" })
  .run();

// Backoff retry: 1s, 2s, 4s (factor 2)
await agent({ llm, retry: { backoff: 2, retries: 4 } })
  .then({ prompt: "might fail" })
  .run();

// Per-step override
await agent({ llm, retry: { delay: 20 } })
  .then({ prompt: "override to immediate", retry: { delay: 0 } })
  .run();
```

## MCP Authentication

Volcano SDK supports OAuth 2.1 and Bearer token authentication per the MCP specification.

### OAuth Authentication (Client Credentials)

```ts
const protectedMcp = mcp("https://api.example.com/mcp", {
  auth: {
    type: 'oauth',
    clientId: process.env.MCP_CLIENT_ID!,
    clientSecret: process.env.MCP_CLIENT_SECRET!,
    tokenEndpoint: 'https://api.example.com/oauth/token'
  }
});

await agent({ llm })
  .then({ prompt: "Use protected tools", mcps: [protectedMcp] })
  .run();
```

### Bearer Token Authentication

```ts
const authMcp = mcp("https://api.example.com/mcp", {
  auth: {
    type: 'bearer',
    token: process.env.MCP_BEARER_TOKEN!
  }
});
```

### Features

- ✅ **MCP Spec Compliant**: Follows OAuth 2.1 standard per MCP specification
- ✅ **OAuth token caching**: Tokens are cached and reused until expiration
- ✅ **Automatic refresh**: Expired tokens refreshed automatically (60s buffer)
- ✅ **Per-endpoint configuration**: Each MCP server can have different auth
- ✅ **Connection pooling**: Authenticated connections pooled separately

## Examples You'll Want to Try

### A. Automatic tool selection (one step)

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});
const weather = mcp("http://localhost:3000/mcp");
const notifications = mcp("http://localhost:4000/mcp");

await agent({ llm })
  .then({
    prompt: "Check SF weather for tomorrow and send me a friendly notification.",
    mcps: [weather, notifications]
  })
  .run(console.log);
```

### B. Two steps, still automatic

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});
const astro = mcp("http://localhost:3211/mcp");
const favorites = mcp("http://localhost:3212/mcp");

await agent({ llm })
  .then({
    prompt: "Find the astrological sign for 1993-07-11.",
    mcps: [astro]
  })
  .then({
    prompt: "Based on the sign Cancer, what are my favorite food and drink?",
    mcps: [favorites]
  })
  .run(console.log);
```

### C. Multi-provider workflow

```ts
import { agent, llmOpenAI, llmAnthropic, llmMistral, llmLlama, mcp } from "volcano-sdk";

const openai = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, model: "claude-3-haiku-20240307" });
const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY!, model: "mistral-small-latest" });
const llama = llmLlama({ baseURL: "http://127.0.0.1:11434", model: "llama3.2:3b" });

const astro = mcp("http://localhost:3211/mcp");

await agent()
  .then({ llm: openai, prompt: "Get astrological sign for 1993-07-11", mcps: [astro] })
  .then({ llm: claude, prompt: "Analyze the personality traits of that sign" })
  .then({ llm: mistral, prompt: "Write a creative horoscope in French" })
  .then({ llm: llama, prompt: "Translate back to English" })
  .run(console.log);
```

### D. Explicit control (when you need it)

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-5-mini" 
});
const cafe = mcp("http://localhost:3000/mcp");

await agent({ llm })
  .then({ prompt: "Recommend a coffee for Ava Rossi from Naples" })
  .then({ mcp: cafe, tool: "order_item", args: { item_id: "espresso" } })
  .run(console.log);
```

## Step context & history

- By default, each step’s LLM prompt automatically includes a compact context from the previous step (last LLM answer and recent tool results). This makes chaining natural without manual plumbing.
- To start fresh for a step, reset the context before it:

```ts
await agent({ llm })
  .then({ prompt: "First question", mcps: [service] })
  .resetHistory()         // clears context for subsequent steps
  .then({ prompt: "Second question (fresh)" })
  .run();
```

## Step hooks (pre/post execution)

Add `pre` and `post` hooks to any step for fine-grained control over execution flow:

```ts
await agent({ llm })
  .then({
    prompt: "Analyze the user data",
    mcps: [analytics],
    pre: () => { console.log("Starting analysis..."); },
    post: () => { console.log("Analysis complete!"); }
  })
  .then({
    prompt: "Generate report",
    pre: () => { startTimer(); },
    post: () => { endTimer(); saveMetrics(); }
  })
  .run((step, stepIndex) => {
    console.log(`Step ${stepIndex + 1} finished`);
  });
```

**Hook execution order:**
1. `pre()` hook (before step execution)
2. Step execution (LLM/MCP calls)
3. `post()` hook (after step completion)
4. `run()` callback (with step result and index)

**Hook characteristics:**
- Hooks are **synchronous functions** (`() => void`)
- Hook errors are **caught and logged** but don't fail the step
- Hooks execute on **every retry attempt** (pre) or **only on success** (post)
- Hooks have access to **closure variables** for state management

## Streaming workflows

Stream step results in real-time as they complete using the `stream()` method:

```ts
// Real-time step streaming
for await (const stepResult of agent({ llm })
  .then({ prompt: "Analyze user data", mcps: [analytics] })
  .then({ prompt: "Generate insights" })
  .then({ prompt: "Create recommendations" })
  .stream()) {
  
  console.log(`Step completed: ${stepResult.prompt}`);
  if (stepResult.toolCalls) {
    console.log(`Tools used: ${stepResult.toolCalls.map(t => t.name).join(', ')}`);
  }
  if (stepResult.llmOutput) {
    console.log(`Result: ${stepResult.llmOutput}`);
  }
  console.log(`Duration: ${stepResult.durationMs}ms`);
}
```

**Streaming with progress tracking:**

```ts
let completedSteps = 0;
const totalSteps = 3;

for await (const stepResult of workflow.stream((step, stepIndex) => {
  completedSteps++;
  console.log(`Progress: ${completedSteps}/${totalSteps} - Step ${stepIndex + 1} done`);
})) {
  // Update UI with step result
  updateProgressBar(completedSteps / totalSteps);
  displayStepResult(stepResult);
}
```

### Getting Started with Streaming

The `stream()` method provides **real-time step results** as your workflow executes, making it perfect for interactive applications where users need immediate feedback. Unlike `run()` which waits for all steps to complete before returning results, `stream()` yields each step result as soon as it finishes.

**Quick start:**
```ts
// Instead of waiting for everything:
const results = await agent({ llm }).then({...}).then({...}).run();

// Get results in real-time:
for await (const stepResult of agent({ llm }).then({...}).then({...}).stream()) {
  console.log(`Step complete: ${stepResult.llmOutput}`);
  updateProgressBar(); // Update UI immediately
}
```

**When to use `stream()` vs `run()`:**

**Choose `stream()` for:**
- **Interactive applications** where users need live progress updates
- **Long-running workflows** (>5 seconds) where feedback improves UX
- **Real-time dashboards** that display results as they arrive
- **Memory-sensitive environments** where you can process and discard results immediately
- **WebSocket/SSE applications** streaming results to clients
- **Early termination scenarios** where you might stop on certain conditions

**Choose `run()` for:**
- **Batch processing** where you need the complete result set
- **Simple scripts** that can wait for full completion
- **Analysis workflows** where you need aggregated metrics (total timing, cost calculations)
- **APIs returning complete responses** to end users
- **Testing and debugging** where you want to inspect all steps together

**Performance difference:** With `stream()`, your first result is available **immediately** when the first step completes, rather than waiting for the entire workflow. In practice, this means users see progress in real-time instead of staring at loading spinners.

**Streaming characteristics:**
- Steps are **yielded immediately** as they complete
- **Same execution logic** as `run()` (retries, timeouts, validation, hooks)
- **Same concurrency rules** - one execution per agent instance
- **Log callbacks work** identically to `run()`
- **Pre/post hooks execute** normally for each step
- **Error handling** stops the stream on first failure
- **Memory efficient** - results can be processed and released incrementally

### Instructions (agent behavior)

- Pass `{ instructions }` in `agent({ ... })` to set global system‑level guidance for the agent. It’s injected before history and the user prompt.
- You can override for a single step by passing `instructions` on that step.

```ts
await agent({ llm, instructions: "You are a restaurant ordering agent. Use only the provided name." })
  .then({ prompt: "What would Marco likely order from For Five?", mcps: [forfive] })
  .then({ prompt: "Create the SMS order in format [QTY]x [ITEM] for [NAME]" })
  .run();

// Per-step override
await agent({ llm, instructions: "GLOBAL INSTR" })
  .then({ prompt: "One" })
  .then({ prompt: "Two", instructions: "STEP INSTR" }) // overrides this step
  .then({ prompt: "Three" }) // falls back to GLOBAL INSTR
  .run();
```

## Advanced Workflow Patterns

Volcano SDK supports powerful control flow patterns for building complex AI agents:

### Parallel Execution

Execute multiple steps simultaneously for faster workflows:

```ts
// Array mode - run multiple tasks in parallel
await agent({ llm })
  .parallel([
    { prompt: "Analyze sentiment" },
    { prompt: "Extract entities" },
    { prompt: "Categorize topic" }
  ])
  .then({ prompt: "Combine all analysis results" })
  .run();

// Named dictionary mode - access results by key
await agent({ llm })
  .parallel({
    sentiment: { prompt: "What's the sentiment?" },
    entities: { prompt: "Extract key entities" },
    summary: { prompt: "Summarize in 5 words" }
  })
  .then((history) => {
    const results = history[0].parallel;
    // Access specific results: results.sentiment, results.entities, results.summary
    return { prompt: "Generate report based on analysis" };
  })
  .run();
```

### Conditional Branching

Route workflows based on conditions:

```ts
// If/else branching
await agent({ llm })
  .then({ prompt: "Is this email spam? Reply YES or NO" })
  .branch(
    (history) => history[0].llmOutput?.includes("YES") || false,
    {
      true: (a) => a
        .then({ prompt: "Categorize spam type" })
        .then({ mcp: notifications, tool: "alert" }),
      false: (a) => a
        .then({ prompt: "Extract action items" })
        .then({ prompt: "Draft reply" })
    }
  )
  .run();

// Switch/case for multiple branches
await agent({ llm })
  .then({ prompt: "Classify ticket priority: HIGH, MEDIUM, or LOW" })
  .switch(
    (history) => history[0].llmOutput?.toUpperCase().trim() || '',
    {
      'HIGH': (a) => a.then({ mcp: pagerduty, tool: "create_incident" }),
      'MEDIUM': (a) => a.then({ mcp: jira, tool: "create_ticket" }),
      'LOW': (a) => a.then({ mcp: email, tool: "queue_for_review" }),
      default: (a) => a.then({ prompt: "Escalate unknown priority" })
    }
  )
  .run();
```

### Loops

Iterate until conditions are met:

```ts
// While loop - continue until done
await agent({ llm })
  .while(
    (history) => {
      if (history.length === 0) return true;
      const last = history[history.length - 1];
      return !last.llmOutput?.includes("COMPLETE");
    },
    (a) => a.then({ prompt: "Process next chunk", mcps: [database] }),
    { maxIterations: 10 }
  )
  .then({ prompt: "Generate final summary" })
  .run();

// For-each loop - process array of items
const customers = ["alice@example.com", "bob@example.com", "charlie@example.com"];
await agent({ llm })
  .forEach(customers, (email, a) => 
    a.then({ prompt: `Generate personalized email for ${email}` })
     .then({ mcp: sendgrid, tool: "send", args: { to: email } })
  )
  .then({ prompt: "Summarize campaign results" })
  .run();

// Retry until success - self-correcting agents
await agent({ llm })
  .retryUntil(
    (a) => a.then({ prompt: "Generate a haiku about AI" }),
    (result) => {
      // Validate 5-7-5 syllable structure
      const lines = result.llmOutput?.split('\n') || [];
      return lines.length === 3; // Simple validation
    },
    { maxAttempts: 5, backoff: 1.5 }
  )
  .run();
```

### Sub-Agent Composition

Build reusable agent components:

```ts
// Define reusable sub-agents
const emailAnalyzer = agent({ llm: claude })
  .then({ prompt: "Extract sender intent" })
  .then({ prompt: "Classify urgency level" });

const responseGenerator = agent({ llm: openai })
  .then({ prompt: "Draft professional response" })
  .then({ prompt: "Add signature" });

// Compose them in larger workflows
await agent({ llm })
  .then({ mcp: gmail, tool: "fetch_unread" })
  .runAgent(emailAnalyzer)  // Run first sub-agent
  .runAgent(responseGenerator)  // Run second sub-agent
  .then({ mcp: gmail, tool: "send_reply" })
  .run();
```

### Combined Patterns

Mix and match for powerful workflows:

```ts
await agent({ llm })
  // Parallel analysis
  .parallel({
    sentiment: { prompt: "Analyze sentiment" },
    intent: { prompt: "Extract intent" },
    priority: { prompt: "Determine priority" }
  })
  
  // Route based on priority
  .switch(
    (h) => h[0].parallel?.priority.llmOutput?.trim() || '',
    {
      'URGENT': (a) => a
        .then({ mcp: slack, tool: "alert_team" })
        .runAgent(escalationAgent),
      
      'NORMAL': (a) => a
        .forEach(responders, (person, ag) => 
          ag.then({ prompt: `Assign to ${person}` })
        ),
      
      default: (a) => a.then({ prompt: "Queue for review" })
    }
  )
  
  // Final step
  .then({ prompt: "Log outcome" })
  .run();
```

## API (tiny and familiar)

- **LLM Providers**: `llmOpenAI()`, `llmAnthropic()`, `llmMistral()`, `llmLlama()`, `llmBedrock()`, `llmVertexStudio()`, `llmAzure()`
- **MCP Tools**: `mcp(url) => MCPHandle`
- **Agent**: `agent({ llm?, instructions?, timeout?, retry? }) => AgentBuilder`
  - **Basic Methods**:
    - `then(step)` - Add sequential step
    - `resetHistory()` - Clear context
    - `run(log?)` - Execute and return all results
    - `stream(log?)` - Execute and yield results incrementally
  - **Advanced Patterns**:
    - `parallel(steps[] | { [key]: step })` - Execute steps concurrently
    - `branch(condition, { true, false })` - Conditional routing
    - `switch(selector, cases)` - Multi-way branching
    - `while(condition, body, opts?)` - Loop until false
    - `forEach(items, body)` - Iterate over array
    - `retryUntil(body, success, opts?)` - Retry until condition met
    - `runAgent(subAgent)` - Compose sub-agents
  - Steps:
    - `{ prompt, llm?, instructions?, timeout?, retry? }` (LLM only)
    - `{ mcp, tool, args?, timeout?, retry? }` (MCP tool only)
    - `{ prompt, llm?, instructions?, mcps: MCPHandle[], timeout?, retry? }` (automatic tool selection)

Each step returns:

```ts
type StepResult = {
  prompt?: string;
  llmOutput?: string;
  mcp?: { endpoint: string; tool: string; result: any };
  toolCalls?: Array<{ name: string; endpoint: string; result: any }>;
};
```

## LLM Providers

Providers live under `src/llms/` and are re‑exported from the SDK entry. Each provider returns an `LLMHandle` with:

- `gen(prompt): Promise<string>` - Basic text generation
- `genWithTools(prompt, tools): Promise<{ content?, toolCalls[] }>` - Function calling with tools
- `genStream(prompt): AsyncGenerator<string>` - Streaming text generation

### Provider Support Matrix

| Provider | Basic Generation | Function Calling | Streaming | MCP Integration |
|----------|------------------|------------------|-----------|-----------------|
| **OpenAI** | ✅ Full | ✅ Native | ✅ Native | ✅ Complete |
| **Anthropic** | ✅ Full | ✅ Native (tool_use) | ✅ Native | ✅ Complete |
| **Mistral** | ✅ Full | ✅ Native | ✅ Native | ✅ Complete |
| **Llama** | ✅ Full | ✅ Via Ollama | ✅ Native | ✅ Complete |
| **AWS Bedrock** | ✅ Full | ✅ Native (Converse API) | ✅ Native | ✅ Complete |
| **Google Vertex Studio** | ✅ Full | ✅ Native (Function calling) | ✅ Native | ✅ Complete |
| **Azure AI** | ✅ Full | ✅ Native (Responses API) | ✅ Native | ✅ Complete |

**All providers support automatic tool selection and multi-step workflows.**

### OpenAI

- Factory: `llmOpenAI({ apiKey, model, baseURL?, options? })`
- **Required**: `apiKey`, `model`
- Defaults: `baseURL: https://api.openai.com/v1`
- Supports: `gen`, `genWithTools` (function/tool calling), `genStream`

**Optional Parameters:**
- `temperature` (0-2): Controls randomness
- `max_completion_tokens`: Maximum tokens to generate (recommended for all models)
- `max_tokens`: Maximum tokens to generate (legacy, supported only by older models)
- `top_p` (0-1): Nucleus sampling
- `frequency_penalty` (-2 to 2): Penalize based on frequency
- `presence_penalty` (-2 to 2): Penalize based on presence
- `stop`: Stop sequences (string or array)
- `seed`: For deterministic outputs
- `response_format`: For JSON mode

```ts
import { agent, llmOpenAI } from "volcano-sdk";

const openai = llmOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-5-mini",
  options: {
    temperature: 0.7,
    max_completion_tokens: 2000,
    top_p: 0.9,
    seed: 42,
  }
});

// Basic
const [{ llmOutput }] = await agent({ llm: openai })
  .then({ prompt: "Say hello in five words." })
  .run();

// Streaming
let text = "";
for await (const chunk of openai.genStream("Reply ONLY with STREAM_OK")) text += chunk;

// Tool calling
const tools = [{
  name: "localhost_3211_mcp.get_sign",
  description: "Lookup astrological sign by birthdate",
  parameters: { type: "object", properties: { birthdate: { type: "string" } }, required: ["birthdate"] },
}];
const toolRes = await openai.genWithTools("Find sign for 1993-07-11", tools);
```

Environment:
- `OPENAI_API_KEY` (required)
- Optional: `OPENAI_MODEL`, `OPENAI_BASE_URL`

### Anthropic (Claude)

- Factory: `llmAnthropic({ apiKey?, client?, model, baseURL?, version?, options? })`
- **Required**: `model` (and either `apiKey` or `client`)
- Defaults: `baseURL: https://api.anthropic.com`, `version: 2023-06-01`
- Supports: `gen`
- Notes: The `anthropic-version` request header is required by the API.

**Optional Parameters:**
- `temperature` (0-1): Controls randomness
- `max_tokens`: Maximum tokens to generate
- `top_p` (0-1): Nucleus sampling
- `top_k`: Sample from top K options
- `stop_sequences`: Array of stop sequences
- `thinking`: Extended thinking configuration (Claude-specific)

```ts
import { agent, llmAnthropic } from "volcano-sdk";

// Use built-in fetch client
const claude = llmAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: "claude-3-haiku-20240307",
  options: {
    temperature: 0.7,
    max_tokens: 2000,
    top_k: 50,
    stop_sequences: ["\n\n"],
  }
});

const [{ llmOutput }] = await agent({ llm: claude })
  .then({ prompt: "Reply ONLY with ANTHROPIC_OK" })
  .run();
```

Environment:
- `ANTHROPIC_API_KEY` (required for built-in client)
- Optional: `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_VERSION` (defaults to `2023-06-01`)

### Llama (OpenAI‑compatible)

- Factory: `llmLlama({ baseURL?, apiKey?, model, client?, options? })`
- **Required**: `model`
- Defaults: `baseURL: http://localhost:11434` (Ollama)
- Supports: `gen`
- Notes: Works with OpenAI‑compatible servers (Ollama/OpenRouter/etc.). Tool calling and streaming not yet implemented.

**Optional Parameters:**
- `temperature` (0-2): Controls randomness
- `max_tokens`: Maximum tokens to generate
- `top_p` (0-1): Nucleus sampling
- `top_k`: Sample from top K options
- `stop`: Stop sequences
- `repeat_penalty`: Penalize repetitions (Ollama-specific)
- `seed`: For deterministic outputs
- `num_predict`: Number of tokens to predict (Ollama-specific)

```ts
import { agent, llmLlama } from "volcano-sdk";

// Local Ollama quickstart
// $ ollama serve &
// $ ollama pull llama3.2:3b
const llama = llmLlama({ 
  baseURL: "http://127.0.0.1:11434", 
  model: "llama3.2:3b",
  options: {
    temperature: 0.7,
    max_tokens: 2000,
    top_k: 40,
    repeat_penalty: 1.1,
  }
});

const [{ llmOutput }] = await agent({ llm: llama })
  .then({ prompt: "Reply ONLY with LLAMA_OK" })
  .run();
```

Environment:
- Optional: `LLAMA_BASE_URL` (e.g., `http://127.0.0.1:11434`), `LLAMA_MODEL`, `LLAMA_API_KEY` (if your endpoint requires it)

### Mistral (Cloud)

- Factory: `llmMistral({ baseURL?, apiKey?, model, client?, options? })`
- **Required**: `model` (and either `apiKey` or `client`)
- Defaults: `baseURL: https://api.mistral.ai`
- Supports: `gen`
- Notes: Uses Mistral's OpenAI‑compatible chat completions endpoint (`/v1/chat/completions`).

**Optional Parameters:**
- `temperature` (0-1): Controls randomness
- `max_tokens`: Maximum tokens to generate
- `top_p` (0-1): Nucleus sampling
- `stop`: Stop sequences
- `safe_prompt`: Enable safety mode (boolean)
- `random_seed`: For deterministic outputs
- `response_format`: For JSON mode

```ts
import { agent, llmMistral } from "volcano-sdk";

const mistral = llmMistral({
  apiKey: process.env.MISTRAL_API_KEY!,
  model: "mistral-small-latest",
  options: {
    temperature: 0.7,
    max_tokens: 2000,
    safe_prompt: true,
  }
});

const [{ llmOutput }] = await agent({ llm: mistral })
  .then({ prompt: "Reply ONLY with MISTRAL_OK" })
  .run();
```

Environment:
- `MISTRAL_API_KEY` (required)
- Optional: `MISTRAL_MODEL`, `MISTRAL_BASE_URL`

### AWS Bedrock

- Factory: `llmBedrock({ model, region?, accessKeyId?, secretAccessKey?, sessionToken?, profile?, roleArn?, client?, options? })`
- Defaults: `region: "us-east-1"`
- **Required**: `model` (choose from available Bedrock models)
- Supports: `gen`, `genWithTools` (Converse API), `genStream` (fallback)
- Notes: Uses AWS Bedrock's Converse API with native tool use support.

**Optional Parameters:**
- `temperature` (0-1): Controls randomness
- `max_tokens`: Maximum tokens to generate
- `top_p` (0-1): Nucleus sampling
- `stop_sequences`: Array of stop sequences

**Authentication methods (in priority order):**

1. **Explicit credentials** (highest priority):
```ts
const bedrock = llmBedrock({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  sessionToken: process.env.AWS_SESSION_TOKEN, // optional for temporary credentials
});
```

2. **Bearer token authentication**:
```ts
const bedrock = llmBedrock({
  region: 'us-east-1',
  bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK!,
});
```

3. **AWS profile**:
```ts
const bedrock = llmBedrock({
  region: 'us-east-1',
  profile: 'my-aws-profile', // Uses ~/.aws/credentials
});
```

4. **IAM role assumption**:
```ts
const bedrock = llmBedrock({
  region: 'us-east-1',
  roleArn: 'arn:aws:iam::123456789012:role/my-bedrock-role',
});
```

5. **AWS credential chain** (default):
```ts
const bedrock = llmBedrock({
  model: 'anthropic.claude-3-sonnet-20240229-v1:0', // model is required
  region: 'us-east-1'
  // Automatically uses: environment variables, instance profiles, 
  // ECS task roles, EKS service accounts, etc.
});
```

**Usage example:**
```ts
import { agent, llmBedrock } from "volcano-sdk";

const bedrock = llmBedrock({
  model: 'anthropic.claude-3-sonnet-20240229-v1:0', // Required
  region: process.env.AWS_REGION || 'us-east-1',
  // Uses AWS credential chain by default
  options: {
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 0.9,
  }
});

const [{ llmOutput }] = await agent({ llm: bedrock })
  .then({ prompt: "Reply ONLY with BEDROCK_OK" })
  .run();
```

**Available model families:**
- **Claude**: `anthropic.claude-3-sonnet-20240229-v1:0`, `anthropic.claude-3-haiku-20240307-v1:0`
- **Titan**: `amazon.titan-text-express-v1`, `amazon.titan-text-lite-v1`
- **Llama**: `meta.llama3-8b-instruct-v1:0`, `meta.llama3-70b-instruct-v1:0`
- **Cohere**: `cohere.command-text-v14`, `cohere.command-light-text-v14`

**Dependencies:**
```bash
npm install @aws-sdk/client-bedrock-runtime
npm install @aws-sdk/credential-providers  # for profiles and roles
```

**Environment variables:**
- Optional: `AWS_REGION`, `AWS_PROFILE`, `BEDROCK_MODEL`
- For explicit auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- For bearer token auth: `AWS_BEARER_TOKEN_BEDROCK`

### Google Vertex Studio (AI Studio)

- Factory: `llmVertexStudio({ model, apiKey, baseURL?, client?, options? })`
- Defaults: `baseURL: "https://aiplatform.googleapis.com/v1"`
- **Required**: `model` (Gemini models), `apiKey` (Google AI Studio API key)
- Supports: `gen`, `genWithTools` (function calling), `genStream` (native)
- Notes: Uses Google AI Studio API with simple API key authentication.

**Optional Parameters:**
- `temperature` (0-2): Controls randomness
- `max_output_tokens`: Maximum tokens to generate
- `top_p` (0-1): Nucleus sampling
- `top_k`: Sample from top K options
- `stop_sequences`: Array of stop sequences
- `candidate_count`: Number of response variations
- `response_mime_type`: For JSON mode (e.g., "application/json")

```ts
import { agent, llmVertexStudio } from "volcano-sdk";

const vertex = llmVertexStudio({
  model: 'gemini-2.5-flash-lite',
  apiKey: process.env.GCP_VERTEX_API_KEY!,
  options: {
    temperature: 0.8,
    max_output_tokens: 2048,
    top_k: 40,
  }
});

const [{ llmOutput }] = await agent({ llm: vertex })
  .then({ prompt: "Reply ONLY with VERTEX_OK" })
  .run();
```

**Available models:**
- **Gemini 1.5**: `gemini-1.5-pro`, `gemini-1.5-flash`
- **Gemini 2.5**: `gemini-2.5-flash-lite` (recommended for most use cases)

**Function calling limitations:**
- ✅ Supports function calling with single tools
- ❌ Multiple tools per call only supported for search tools
- 💡 Use multi-step workflows for complex tool orchestration

**Environment variables:**
- `GCP_VERTEX_API_KEY` (required)
- Optional: `VERTEX_MODEL`

### Azure AI (Azure OpenAI Service)

- Factory: `llmAzure({ model, endpoint, apiVersion?, apiKey?, accessToken?, client?, options? })`
- **Required**: `model` (deployment model), `endpoint` (Azure resource URL)
- Defaults: `apiVersion: "2025-04-01-preview"`
- Supports: `gen`, `genWithTools` (Responses API), `genStream` (native)
- Notes: Uses Azure OpenAI Service Responses API with enterprise authentication.

**Optional Parameters:**

**⚠️ Important**: Azure Responses API currently does **not support** optional configuration parameters. All inference parameters (`max_output_tokens`, `seed`, `temperature`, `top_p`, etc.) are rejected with HTTP 400 errors. The `AzureOptions` type is defined for API consistency but parameters cannot be used in practice. This is a limitation of Azure's Responses API endpoint.

**Authentication methods (in priority order):**

1. **API Key** (simplest):
```ts
const azure = llmAzure({
  model: 'gpt-5-mini',
  endpoint: 'https://your-resource.openai.azure.com/openai/responses',
  apiKey: process.env.AZURE_AI_API_KEY!
});
```

2. **Entra ID Access Token**:
```ts
const azure = llmAzure({
  model: 'gpt-5-mini',
  endpoint: 'https://your-resource.openai.azure.com/openai/responses', 
  accessToken: process.env.AZURE_ACCESS_TOKEN!
});
```

3. **Azure Default Credential Chain**:
```ts
const azure = llmAzure({
  model: 'gpt-5-mini',
  endpoint: 'https://your-resource.openai.azure.com/openai/responses'
  // Uses Azure SDK: Managed Identity, Service Principal, CLI, etc.
});
```

**Usage example:**
```ts
import { agent, llmAzure } from "volcano-sdk";

const azure = llmAzure({
  model: 'gpt-5-mini',
  endpoint: 'https://your-resource.openai.azure.com/openai/responses',
  apiKey: process.env.AZURE_AI_API_KEY!,
  // Note: Azure Responses API does not accept options parameters
});

const [{ llmOutput }] = await agent({ llm: azure })
  .then({ prompt: "Reply ONLY with AZURE_OK" })
  .run();
```

**Dependencies:**
```bash
npm install @azure/identity  # for Entra ID and credential chain
```

**Environment variables:**
- `AZURE_AI_API_KEY` (required for API key auth)
- `AZURE_AI_ENDPOINT` (required)
- Optional: `AZURE_AI_MODEL`, `AZURE_AI_API_VERSION`
- For Entra ID: `AZURE_ACCESS_TOKEN`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

## Requirements

- Node.js 18.17+
- `OPENAI_API_KEY` (for LLM usage)
- MCP services (for tool execution)

## Run locally

```bash
npm install
npm run build
# try the examples (set OPENAI_API_KEY)
npx tsx examples/automatic.ts
```

---

Questions or ideas? Open an issue — we’d love to hear how you’re using Volcano SDK.
