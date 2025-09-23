[![CI](https://github.com/Kong/volcano-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Kong/volcano-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/volcano-sdk.svg)](https://www.npmjs.com/package/volcano-sdk)

# 🌋 Volcano SDK

Build AI agents that seamlessly combine LLM reasoning with real-world actions via MCP tools — in just a few lines of TypeScript.

## Why Volcano SDK

- ⚡️ **Tiny, modern API**: Chain steps with `.then()` and `.run()`
- ✨ **Automatic tool selection**: Let the LLM choose which MCP tools to call
- 🔧 **MCP (Streamable HTTP)**: Works out of the box with MCP servers
- 🧩 **Pluggable LLM providers**: Providers live in `src/llms/` (OpenAI included)
- 🛡 **TypeScript-first**: Strong types with minimal ceremony

## Install

```bash
npm install volcano-sdk
npm install @modelcontextprotocol/sdk openai
```

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

Per‑step override:

```ts
await agent({ llm })
  .then({ prompt: "Use default LLM" })
  .then({ prompt: "Use a different LLM for this step", llm: llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" }) })
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

### C. Explicit control (when you need it)

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

- `llmOpenAI({ apiKey, model?, baseURL? }) => LLMHandle`
- `mcp(url) => MCPHandle`
- `agent({ llm?, instructions?, timeout?, retry? }) => { resetHistory(), then(step), run(log?) }`
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

## Providers

- OpenAI is provided out of the box (`llmOpenAI`).
- Providers live under `src/llms/` and are re‑exported from the SDK entry.
- Add your own provider by returning an `LLMHandle` that supports `gen()`, `genWithTools()`, and (optionally) `genStream()`.

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