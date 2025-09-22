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

// Set a default LLM once with agent().llm(llm)
const results = await agent()
  .llm(llm)
  .then({
    prompt: "For birthdate 1993-07-11, determine the sign and then my favorite food and drink.",
    mcps: [astro, favorites]
  })
  .run();
```

Per‑step override:

```ts
await agent()
  .llm(llm)
  .then({ prompt: "Use default LLM" })
  .then({ prompt: "Use a different LLM for this step", llm: llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" }) })
  .run();
```

## Examples You’ll Want to Try

### A. Automatic tool selection (one step)

```ts
import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
const weather = mcp("http://localhost:3000/mcp");
const notifications = mcp("http://localhost:4000/mcp");

await agent()
  .llm(llm)
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

await agent()
  .llm(llm)
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

await agent()
  .llm(llm)
  .then({ prompt: "Recommend a coffee for Ava Rossi from Naples" })
  .then({ mcp: cafe, tool: "order_item", args: { item_id: "espresso" } })
  .run(console.log);
```

## API (tiny and familiar)

- `llmOpenAI({ apiKey, model?, baseURL? }) => LLMHandle`
- `mcp(url) => MCPHandle`
- `agent() => { llm(handle), then(step), run(log?) }`
  - Steps:
    - `{ prompt, llm? }` (LLM only; uses default unless overridden)
    - `{ mcp, tool, args? }` (MCP tool only)
    - `{ prompt, llm?, mcps: MCPHandle[] }` (automatic tool selection; uses default unless overridden)

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