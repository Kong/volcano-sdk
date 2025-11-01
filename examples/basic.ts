import { agent, llmOpenAI, mcp } from "../dist/volcano-sdk.js";

(async () => {
  const llm = llmOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!, 
    model: "gpt-4o-mini" 
  });
  const cafe = mcp("http://localhost:3000/mcp");
  const twilio = mcp("http://localhost:4000/mcp");

  const user = { name: "Ava Rossi", from: "Naples, Italy", birthdate: "1993-07-11" };

  const explicitResults = await agent({ llm })
    .then({ prompt: `Best coffee for ${user.name} (${user.from}, born ${user.birthdate})` })
    .then({ mcp: cafe, tool: "order_item", args: { item_id: "espresso" } })
    .then({ prompt: "Send SMS with order details" })
    .then({ mcp: twilio, tool: "send_sms", args: { to: "+15551234567", from: "+15557654321", body: "Order for Ava: espresso." } })
    .run((step) => console.log("[EXPLICIT STEP]", step));

  console.log("Explicit Done:", explicitResults.at(-1));

  console.log("\n=== AUTOMATIC APPROACH (New) ===");
  const autoResults = await agent({ llm })
    .then({ 
      prompt: `Help ${user.name} from ${user.from} (born ${user.birthdate}) order her favorite coffee and send her a confirmation SMS`, 
      mcps: [cafe, twilio] 
    })
    .run((step) => console.log("[AUTO STEP]", step));

  console.log("Auto Done:", autoResults.at(-1));
})();