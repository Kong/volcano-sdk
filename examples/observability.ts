import { agent, llmOpenAI, createVolcanoTelemetry } from "../dist/volcano-sdk.js";

// Example: OpenTelemetry integration with Volcano SDK
// Run with: npx tsx examples/observability.ts

(async () => {
  // Create telemetry with direct endpoint configuration
  const telemetry = createVolcanoTelemetry({
    serviceName: 'volcano-local-test',
    endpoint: 'http://localhost:4318', // Auto-configures OTLP exporters
  });

  const llm = llmOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  });

  console.log("🔬 Running agent with OpenTelemetry enabled...");
  console.log("📊 View traces at: http://localhost:16686 (Jaeger)");
  console.log("📈 View metrics at: http://localhost:3000 (Grafana, admin/admin)");
  console.log("🔍 Query metrics at: http://localhost:9090 (Prometheus)\n");

  // Run a sample workflow with named agent and named steps
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

  console.log("\n✅ Workflow complete!");
  console.log(`📝 Results: ${results.length} steps`);
  console.log(`⏱️  Total time: ${results[results.length - 1].totalDurationMs}ms`);
  console.log(`🤖 Total LLM time: ${results[results.length - 1].totalLlmMs}ms`);
  
  console.log("\n✨ Telemetry automatically flushed!");
  console.log("\n🔍 Check the dashboards:");
  console.log("  📊 Jaeger UI: http://localhost:16686");
  console.log("     Service: volcano-local-test");
  console.log("     See: Step names, LLM providers, agent relationships");
  console.log("  📈 Grafana: http://localhost:3000 (admin/admin)");
  console.log("     Import: grafana-volcano-dashboard.json");
  console.log("     See: All 35 panels with live data!");
  console.log("  🔍 Prometheus: http://localhost:9090");
  console.log("     Query: volcano_llm_tokens_total");
})();

