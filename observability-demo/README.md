# Observability Demo

Local observability stack with Jaeger, Prometheus, and Grafana.

## Quick Start

**From project root:**

```bash
# Start the stack
docker compose -f observability-demo/docker-compose.observability.yml up -d

# Run the example
export OPENAI_API_KEY="your-key-here"
npx tsx examples/09-observability.ts

# View traces
open http://localhost:16686  # Jaeger

# View metrics
open http://localhost:3000   # Grafana (admin/admin)
```

## What You Get

- **Jaeger** (localhost:16686) - Distributed traces
- **Grafana** (localhost:3000) - Metrics dashboard
- **Prometheus** (localhost:9090) - Metrics storage
- **OTLP Collector** (localhost:4318) - Receives telemetry

## Cleanup

```bash
docker compose -f observability-demo/docker-compose.observability.yml down
```

## Dashboard

Import `grafana-volcano-dashboard.json` in Grafana to see:
- Token consumption by provider/model
- Workflow duration and success rate
- Agent analytics and collaboration
- Error tracking

See [docs](https://volcano.dev/docs/observability) for more.

