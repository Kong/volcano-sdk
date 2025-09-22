import { agent, llmOpenAI, mcp } from "../dist/volcano-sdk.js";

// Run with: npx tsx examples/basic.ts
// (make sure OPENAI_API_KEY is set, and MCP servers are running locally)

(async () => {
  const llm = llmOpenAI("default", { apiKey: process.env.OPENAI_API_KEY! });
  const cafe = mcp("cafe", "http://localhost:3000/mcp");
  const twilio = mcp("twilio", "http://localhost:4000/mcp");

  const user = { name: "Ava Rossi", from: "Naples, Italy", birthdate: "1993-07-11" };

  console.log("=== EXPLICIT APPROACH (Original) ===");
  const explicitResults = await agent()
    .then({ prompt: `Best coffee for ${user.name} (${user.from}, born ${user.birthdate})`, llm })
    .then({ mcp: cafe, tool: "order_item", args: { item_id: "espresso" } })
    .then({ prompt: "Send SMS with order details", llm })
    .then({ mcp: twilio, tool: "send_sms", args: { to: "+15551234567", from: "+15557654321", body: "Order for Ava: espresso." } })
    .run((step) => console.log("[EXPLICIT STEP]", step));

  console.log("Explicit Done:", explicitResults.at(-1));

  console.log("\n=== AUTOMATIC APPROACH (New) ===");
  const autoResults = await agent()
    .then({ 
      prompt: `Help ${user.name} from ${user.from} (born ${user.birthdate}) order her favorite coffee and send her a confirmation SMS`, 
      llm, 
      mcps: [cafe, twilio] 
    })
    .run((step) => console.log("[AUTO STEP]", step));

  console.log("Auto Done:", autoResults.at(-1));
})();