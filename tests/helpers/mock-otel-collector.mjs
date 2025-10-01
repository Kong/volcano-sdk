// Mock OpenTelemetry Collector for testing
import express from 'express';

const app = express();
app.use(express.json());

// Storage for received telemetry data
const receivedSpans = [];
const receivedMetrics = [];

// OTLP HTTP endpoint for traces
app.post('/v1/traces', (req, res) => {
  console.log('[Collector] Received traces request');
  console.log('[Collector] Body keys:', Object.keys(req.body || {}));
  
  const spans = req.body?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans || [];
  console.log('[Collector] Parsed spans:', spans.length);
  
  spans.forEach(span => {
    console.log('[Collector] Span:', span.name);
    receivedSpans.push({
      name: span.name,
      attributes: span.attributes || [],
      status: span.status,
      startTime: span.startTimeUnixNano,
      endTime: span.endTimeUnixNano
    });
  });
  
  console.log('[Collector] Total received spans:', receivedSpans.length);
  res.status(200).json({ partialSuccess: {} });
});

// OTLP HTTP endpoint for metrics
app.post('/v1/metrics', (req, res) => {
  const metrics = req.body?.resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics || [];
  metrics.forEach(metric => {
    receivedMetrics.push({
      name: metric.name,
      description: metric.description,
      unit: metric.unit,
      data: metric.histogram || metric.sum || metric.gauge
    });
  });
  
  res.status(200).json({ partialSuccess: {} });
});

// Helper endpoints for tests
app.get('/test/spans', (req, res) => {
  res.json(receivedSpans);
});

app.get('/test/metrics', (req, res) => {
  res.json(receivedMetrics);
});

app.post('/test/reset', (req, res) => {
  receivedSpans.length = 0;
  receivedMetrics.length = 0;
  res.json({ reset: true });
});

const port = process.env.PORT || 4318;
app.listen(port, () => console.log(`[mock-otel-collector] listening on :${port}`));
