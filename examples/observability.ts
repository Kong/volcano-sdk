import { agent, llmOpenAI, createVolcanoTelemetry } from "../dist/volcano-sdk.js";

(async () => {
  const telemetry = createVolcanoTelemetry({
    serviceName: 'volcano-local-test',
    endpoint: 'http://localhost:4318'
  });

  const llm = llmOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  });

  console.log("Traces: http://localhost:16686 (Jaeger)");
  console.log("Metrics: http://localhost:3000 (Grafana)");
  console.log("Prometheus: http://localhost:9090\n");

  const results = await agent({ 
    llm, 
    telemetry,
    name: 'demo-agent',
    description: 'Demonstrates observability features'
  })
    .then({ 
      name: 'typescript-definition',
      prompt: "What is TypeScript in one sentence?" 
    })
    .then({ 
      name: 'popularity-analysis',
      prompt: "Why is it popular?" 
    })
    .then({ 
      name: 'benefits-extraction',
      prompt: "Give me 3 key benefits" 
    })
    .run();

  const final = results[results.length - 1];
  console.log(`\n${results.length} steps, ${final.totalDurationMs}ms total, ${final.totalLlmMs}ms LLM`);
})();

