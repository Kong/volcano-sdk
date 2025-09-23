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
- [API Reference](#api-tiny-and-familiar)
- [LLM Providers](#llm-providers)
- [Concurrency & Performance](#concurrency--performance)
- [Errors & Diagnostics](#errors--diagnostics)
- [Examples](#examples-youll-want-to-try)
- [Timeouts](#timeouts)
- [Retries](#retries)
- [Requirements](#requirements)

## Supported Providers

Volcano SDK supports **4 major LLM providers** with full function calling and MCP integration:

✅ OpenAI
✅ Anthropic
✅ Mistral
✅ Llama

All providers support:

- Automatic tool selection
- Multi-step workflows with context
- Schema validation
- Retries and error handling

## Install

```bash
npm install volcano-sdk
npm install @modelcontextprotocol/sdk openai
```

## Quick start (hello world)

```ts
import { agent, llmOpenAI } from "volcano-sdk";

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });

const results = await agent({ llm })
  .then({ prompt: "Say hello to Marco in one short sentence." })
  .run();

console.log(results[0].llmOutput);
```

Two-step with a sample MCP tool (automatic selection):

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
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

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });

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
import { agent, llmOpenAI, llmAnthropic, llmMistral, llmLlama, mcp } from "volcano-sdk";

const openai = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY! });
const llama = llmLlama({ baseURL: "http://127.0.0.1:11434" });

const astro = mcp("http://localhost:3211/mcp");

await agent()
  .then({ llm: openai, prompt: "Get astrological sign for 1993-07-11", mcps: [astro] })
  .then({ llm: claude, prompt: "Analyze the personality traits of that sign" })
  .then({ llm: mistral, prompt: "Write a creative horoscope in French" })
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

## Examples You’ll Want to Try

### A. Automatic tool selection (one step)

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
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

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
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

const openai = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY! });
const llama = llmLlama({ baseURL: "http://127.0.0.1:11434" });

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

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
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

## API (tiny and familiar)

- **LLM Providers**: `llmOpenAI()`, `llmAnthropic()`, `llmMistral()`, `llmLlama()`
- **MCP Tools**: `mcp(url) => MCPHandle`
- **Agent**: `agent({ llm?, instructions?, timeout?, retry? }) => { resetHistory(), then(step), run(log?) }`
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

**All providers support automatic tool selection and multi-step workflows.**

### Provider Notes:
- **OpenAI**: Industry standard, most reliable for production
- **Anthropic**: Excellent for analytical and safety-critical tasks
- **Mistral**: Great for multilingual and European compliance needs
- **Llama**: Perfect for local/private deployments via Ollama

### OpenAI

- Factory: `llmOpenAI({ apiKey, model?, baseURL? })`
- Defaults: `model: "gpt-5-mini"`, `baseURL: https://api.openai.com/v1`
- Supports: `gen`, `genWithTools` (function/tool calling), `genStream`

```ts
import { agent, llmOpenAI } from "volcano-sdk";

const openai = llmOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: process.env.OPENAI_MODEL || "gpt-5-mini",
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

- Factory: `llmAnthropic({ apiKey?, client?, model?, baseURL?, version? })`
- Defaults: `model: "claude-4-sonnet"`, `baseURL: https://api.anthropic.com`, `version: 2023-06-01`
- Supports: `gen`
- Notes: The `anthropic-version` request header is required by the API.

```ts
import { agent, llmAnthropic } from "volcano-sdk";

// Use built-in fetch client
const claude = llmAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
});

const [{ llmOutput }] = await agent({ llm: claude })
  .then({ prompt: "Reply ONLY with ANTHROPIC_OK" })
  .run();
```

Environment:
- `ANTHROPIC_API_KEY` (required for built-in client)
- Optional: `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_VERSION` (defaults to `2023-06-01`)

### Llama (OpenAI‑compatible)

- Factory: `llmLlama({ baseURL?, apiKey?, model?, client? })`
- Defaults: `baseURL: http://localhost:11434` (Ollama), `model: "llama3-8b-instruct"`
- Supports: `gen`
- Notes: Works with OpenAI‑compatible servers (Ollama/OpenRouter/etc.). Tool calling and streaming not yet implemented.

```ts
import { agent, llmLlama } from "volcano-sdk";

// Local Ollama quickstart
// $ ollama serve &
// $ ollama pull llama3.2:3b
const llama = llmLlama({ baseURL: process.env.LLAMA_BASE_URL || "http://127.0.0.1:11434", model: process.env.LLAMA_MODEL || "llama3.2:3b" });

const [{ llmOutput }] = await agent({ llm: llama })
  .then({ prompt: "Reply ONLY with LLAMA_OK" })
  .run();
```

Environment:
- Optional: `LLAMA_BASE_URL` (e.g., `http://127.0.0.1:11434`), `LLAMA_MODEL`, `LLAMA_API_KEY` (if your endpoint requires it)

### Mistral (Cloud)

- Factory: `llmMistral({ baseURL?, apiKey?, model?, client? })`
- Defaults: `baseURL: https://api.mistral.ai`, `model: "mistral-small-latest"`
- Supports: `gen`
- Notes: Uses Mistral’s OpenAI‑compatible chat completions endpoint (`/v1/chat/completions`).

```ts
import { agent, llmMistral } from "volcano-sdk";

const mistral = llmMistral({
  apiKey: process.env.MISTRAL_API_KEY!,
  baseURL: process.env.MISTRAL_BASE_URL || "https://api.mistral.ai",
  model: process.env.MISTRAL_MODEL || "mistral-small-latest"
});

const [{ llmOutput }] = await agent({ llm: mistral })
  .then({ prompt: "Reply ONLY with MISTRAL_OK" })
  .run();
```

Environment:
- `MISTRAL_API_KEY` (required)
- Optional: `MISTRAL_MODEL`, `MISTRAL_BASE_URL`

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