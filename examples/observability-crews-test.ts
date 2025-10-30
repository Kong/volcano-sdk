import { agent, llmOpenAI, createVolcanoTelemetry } from "../dist/volcano-sdk.js";

// Example showing full observability with agent crews
// This will populate ALL dashboard panels including agent relationships
// Run with: npx tsx examples/observability-crews-test.ts

(async () => {
  const telemetry = createVolcanoTelemetry({
    serviceName: 'volcano-crews-demo',
    endpoint: 'http://localhost:4318',
  });

  const llm = llmOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  });

  console.log("🎭 Running Multi-Agent Crew with Full Observability\n");

  // Define specialized agents
  const researcher = agent({
    llm,
    telemetry,
    name: 'researcher',
    description: 'Gathers information and analyzes topics'
  });

  const writer = agent({
    llm,
    telemetry,
    name: 'writer',
    description: 'Creates engaging content'
  });

  const editor = agent({
    llm,
    telemetry,
    name: 'editor',
    description: 'Polishes and improves content'
  });

  // Coordinator with multiple delegations
  const results = await agent({ 
    llm, 
    telemetry,
    name: 'coordinator'
  })
    .then({
      name: 'content-creation',
      prompt: 'Write a short paragraph about TypeScript benefits',
      agents: [researcher, writer, editor],
      maxAgentIterations: 5
    })
    .run();

  console.log("\n✅ Crew workflow complete!");
  console.log("\n✨ Telemetry automatically flushed!");
  console.log("\n📊 Check Grafana - All panels should now populate:");
  console.log("   • Agent executions by name");
  console.log("   • Token consumption by agent");
  console.log("   • Parent → child relationships");
  console.log("   • Agent collaboration heatmap");
  console.log("\n🔍 View dashboards:");
  console.log("   📈 Grafana: http://localhost:3000");
  console.log("   📊 Jaeger: http://localhost:16686");
})();

