# Volcano SDK - Observability Demo

Local observability stack for testing and development with Volcano SDK.

## 🚀 Quick Start

### 1. Start the Stack

```bash
docker compose -f observability-demo/docker-compose.observability.yml up -d
```

This starts:
- **OpenTelemetry Collector** (port 4318) - Receives traces and metrics
- **Jaeger** (port 16686) - Distributed tracing UI
- **Prometheus** (port 9090) - Metrics storage
- **Grafana** (port 3000) - Visualization dashboard

### 2. Run Examples

```bash
export OPENAI_API_KEY="your-key-here"
npx tsx examples/observability.ts
```

### 3. View Data

**Jaeger (Traces)**
- URL: http://localhost:16686
- Service: `volcano-local-test`
- See: Step names, LLM providers, agent relationships

**Grafana (Dashboard)**
- URL: http://localhost:3000
- Login: admin / admin
- Import: `observability-demo/grafana-volcano-dashboard.json`
- See: All 35 panels with live metrics

**Prometheus (Metrics)**
- URL: http://localhost:9090
- Query: `volcano_llm_tokens_total`
- See: Raw metrics data

## 📁 Files in This Directory

| File | Purpose |
|------|---------|
| `docker-compose.observability.yml` | Docker Compose stack definition |
| `otel-collector-config.yaml` | OpenTelemetry Collector configuration |
| `prometheus.yml` | Prometheus scrape configuration |
| `grafana-datasources.yml` | Grafana datasource provisioning |
| `grafana-volcano-dashboard.json` | Pre-built dashboard with 35 panels |

## 🎯 Dashboard Panels

The Grafana dashboard includes:

**Executive Overview:**
- Total tokens consumed
- Success rate
- Active workflows per minute
- Average workflow duration

**Agent Analytics:**
- Top 10 agents by execution count
- Top 10 agents by token consumption
- Agent collaboration heatmap
- Parent → child agent relationships

**Token Economics:**
- Token consumption by provider
- Token consumption by model
- Input vs output token ratio
- Tokens per agent name

**Performance:**
- Workflow duration (p50, p95, p99)
- LLM latency by provider
- Step duration analysis
- Agent efficiency metrics

**Tools & Errors:**
- MCP tool call analytics
- Error tracking
- Workflow step distribution

## 🧹 Cleanup

Stop and remove all containers:
```bash
docker compose -f observability-demo/docker-compose.observability.yml down
```

Stop and remove all data (volumes):
```bash
docker compose -f observability-demo/docker-compose.observability.yml down -v
```

## 🔧 Troubleshooting

**Grafana dashboard empty?**
1. Wait 5-10 seconds after running examples
2. Check Prometheus has data: http://localhost:9090
3. Query: `volcano_llm_tokens_total`
4. Re-import the dashboard

**Jaeger not showing traces?**
1. Check collector logs: `docker compose logs otel-collector`
2. Verify examples are using telemetry
3. Check service name matches in Jaeger UI

**Containers not starting?**
1. Check ports are available: `lsof -i :4318,16686,9090,3000`
2. View logs: `docker compose logs`
3. Restart: `docker compose down && docker compose up -d`

## 📚 Learn More

- **Observability Docs**: `web/src/content/docs/observability.mdx`
- **Examples**: `examples/observability.ts`, `examples/observability-crews-test.ts`
- **SDK Website**: https://volcano.dev/docs/observability

