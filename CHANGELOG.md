# Changelog

All notable changes to Volcano SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-10-30

### Added

- **Comprehensive Token Tracking**: All LLM providers (OpenAI, Anthropic, Mistral, Llama, Bedrock, Vertex Studio, Azure) now track input/output token usage. Metrics include `volcano.llm.tokens.input`, `volcano.llm.tokens.output`, `volcano.llm.tokens.total` with provider, model, and agent_name labels. Enables answering "Which agent consumes most tokens?" and "Which provider is most cost-effective?"

- **Agent Relationship Metrics**: Track parent-child agent relationships with `volcano.agent.subagent_calls` and `volcano.agent.executions`. Enables answering "What agent is used most?" and "What's the parent-child usage pattern?"

- **Comprehensive Grafana Dashboard**: 23-panel dashboard (`grafana-volcano-comprehensive.json`) with agent analytics, token economics, performance metrics, and error tracking. Answers questions like "Which agent uses most tokens?", "What are the parent-child relationships?", and "Which provider is fastest?"

### Changed

- **Improved Context History**: `buildHistoryContextChunked()` now includes all steps' LLM outputs (instead of just the last one), showing them as a numbered list when there are multiple outputs. The existing `contextMaxChars` limit ensures context doesn't grow unbounded. This provides full conversation history for multi-step workflows and sub-agents.

### Fixed

- **Sub-Agents Now Receive Parent Context**: Fixed bug where sub-agents invoked via `.runAgent()` did not receive the parent agent's context (conversation history, LLM outputs, tool results). Sub-agents previously started with a blank slate, lacking critical information like issue numbers, repo names, and previous decisions. Now sub-agents automatically inherit parent context, enabling proper composition workflows. For example, a labeler agent can now see which issue was retrieved and analyzed by the parent agent.

## [1.0.2] - 2025-10-29

### Added

- **Autonomous Multi-Agent Crews**: Define specialized agents with names and descriptions, then let an LLM coordinator automatically route work to the right agent based on capabilities. Like automatic tool selection, but for agents. No manual orchestration required—just describe what each agent does and the coordinator handles delegation.
  ```typescript
  const researcher = agent({ llm, name: 'researcher', description: '...' });
  const writer = agent({ llm, name: 'writer', description: '...' });
  
  await agent({ llm })
    .then({
      prompt: 'Write a blog post about AI',
      agents: [researcher, writer],
      maxAgentIterations: 5
    })
    .run();
  ```

- **Live Waiting Timer**: "⏳ Waiting for LLM" now shows elapsed time (`⏳ Waiting for LLM | 2.1s`) updating every 100ms. Makes long waits feel responsive instead of frozen. Applies to both regular steps and agent crew coordination.

- **Simplified Observability Setup**: `createVolcanoTelemetry()` now accepts an `endpoint` parameter for auto-configuration. No need to manually set up OpenTelemetry SDK - just pass `endpoint: 'http://localhost:4318'` and Volcano auto-configures trace and metric exporters.
  ```typescript
  const telemetry = createVolcanoTelemetry({
    serviceName: 'my-app',
    endpoint: 'http://localhost:4318'  // Auto-configures everything!
  });
  ```

- **Local Observability Stack**: Added complete Docker Compose setup with Prometheus, Grafana, Jaeger, and OpenTelemetry Collector. Includes basic Grafana dashboard for agent performance monitoring. See `OBSERVABILITY_TESTING.md` for local testing guide.

- **Context Persistence Test Suite**: New comprehensive tests for GitHub issue handler workflows verify that context (issue numbers, IDs, parameters) persists correctly across multi-step MCP tool calls.

### Changed

- **Improved Progress Display for Agent Crews**: Delegated sub-agents now suppress their progress output when called by a coordinator. Only the parent coordinator shows delegation progress (⚡ researcher → task). Explicit sub-agents (`.runAgent()`) still show step numbering for composition workflows.

- **Updated Dependencies**:
  - `openai`: v5.23 → v6.7 (major update, no breaking changes for our usage)
  - `express`: v4.21 → v5.1 (test servers only)
  - `vitest`: v3.2 → v4.0
  - `@modelcontextprotocol/sdk`: v1.18 → v1.20
  - `@opentelemetry/sdk-node`: v0.205 → v0.207
  - `zod`: Stayed on v3.23 (v4 incompatible with MCP SDK)

- **Better Llama Support**: Upgraded default model from `llama3.2:3b` to `llama3.1:8b` for significantly improved tool calling reliability. Increased timeouts in CI to accommodate the larger model's slower inference.

- **Cleaner Test Output**: Added `hideProgress: true` to 25+ test files. Only progress-specific tests show output now, making test runs much cleaner.

- **Progress Format**: Unified all "Waiting" messages to use `|` separator (`⏳ Waiting for LLM | 2.1s`) for consistency with token progress display.

### Fixed

- **Critical: Context Now Includes Tool Arguments**: Fixed bug where tool call parameters (like `issue_number: 123`) were lost across steps. Context now shows both arguments and results: `get_issue({"issue_number":123}) -> {result}`. This was causing multi-step workflows to lose track of IDs, numbers, and other critical parameters.

- **Critical: Context Aggregates Across All Steps**: Previously, context only included tool results from the most recent step. Now aggregates tool calls from the entire history (up to `contextMaxToolResults`), preventing data loss in multi-step MCP workflows.

- **Robust Test Assertions**: Fixed flaky test that failed when LLM returned "Step 3." instead of "Step3". Now strips whitespace before matching to handle formatting variations.

- **Process Cleanup**: MCP test servers now use `SIGKILL` instead of `SIGTERM` for reliable cleanup. Added `pretest` hook that automatically kills zombie servers before test runs. No more port conflicts from interrupted tests.

- **Missing Dependencies**: Added `express`, `cors`, and `zod` to devDependencies for MCP test server functionality.

### Removed

- **Environment Variable Clutter**: Removed 8 unnecessary CI environment variables (`OPENAI_BASE_URL`, `LLAMA_MODEL`, `BEDROCK_MODEL`, etc.). Configuration defaults now live in test code, not CI configuration. Only API keys remain in CI secrets.

- **Conditional Test Skipping**: Removed all `if (!env) { return; }` logic from tests. Tests now fail properly with clear error messages instead of silently skipping when required environment variables are missing.

## Documentation

### Added

- **Complete API Reference**: Documented all agent options including previously undocumented ones: `maxToolIterations`, `hideProgress`, `telemetry`, `mcpAuth`, `name`, `description`.

- **Multi-Agent Crews Guide**: Comprehensive documentation in Features section showing autonomous coordination, real-world examples, and benefits.

- **Default Values**: Explicitly documented all defaults including `retry: { retries: 3, delay: 0 }`, `timeout: 60`, `maxToolIterations: 4`.

### Changed

- **Prominent Feature Highlighting**: Multi-Agent Crews now featured prominently in README and documentation as a key differentiator.

## Internal

### Added

- **Zombie Server Killer**: Created `scripts/kill-test-servers.sh` utility to clean up orphaned MCP server processes on all test ports.

### Changed

- **Test Infrastructure**: 
  - Vitest test timeout increased to 120s for two-step provider tests (CI is slower)
  - Llama tests get 300s timeouts due to larger model size
  - Auto-cleanup runs before every test via `pretest` hook

- **CI Configuration Simplified**: `.github/workflows/ci.yml` now only sets API keys. Model names and endpoints are hardcoded in tests with sensible defaults.

- **Web Build Process**: Added TOC and search index generation to web tests CI workflow. Tests now fail if generated navigation is out of sync with MDX files.

---

## How to Read This Changelog

- **Added**: New features and capabilities
- **Changed**: Modifications to existing functionality  
- **Fixed**: Bug fixes
- **Removed**: Deprecated or removed features
- **Documentation**: Changes to docs, guides, and API references
- **Internal**: Development, testing, and tooling improvements

For migration guides and detailed breaking changes, see [MIGRATION.md](MIGRATION.md) (when applicable).

