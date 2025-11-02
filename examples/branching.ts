import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

console.log("If/Else Branch:");
const email = "Congratulations! You won $1,000,000!";

const branchResult = await agent({ llm })
  .then({ prompt: `Is this email spam? "${email}". Reply YES or NO only.` })
  .branch(
    (history) => history[0].llmOutput?.toUpperCase().includes("YES") || false,
    {
      true: (a) => a.then({ prompt: "Say: Moved to spam folder" }),
      false: (a) => a.then({ prompt: "Say: Email is safe" })
    }
  )
  .run();

console.log("Decision:", branchResult[0].llmOutput);
console.log("Action:", branchResult[1].llmOutput);

console.log("\nSwitch Statement:");
const ticket = "My account is locked and I can't log in!";

const switchResult = await agent({ llm })
  .then({ prompt: `Classify support ticket priority: "${ticket}". Reply: URGENT, HIGH, MEDIUM, or LOW` })
  .switch(
    (history) => history[0].llmOutput?.toUpperCase().trim() || '',
    {
      'URGENT': (a) => a.then({ prompt: "Escalate to on-call engineer immediately" }),
      'HIGH': (a) => a.then({ prompt: "Assign to senior support within 1 hour" }),
      'MEDIUM': (a) => a.then({ prompt: "Add to support queue" }),
      'LOW': (a) => a.then({ prompt: "Send auto-reply with FAQ link" }),
      default: (a) => a.then({ prompt: "Re-classify manually" })
    }
  )
  .run();

console.log("Priority:", switchResult[0].llmOutput);
console.log("Action:", switchResult[1].llmOutput);

console.log("\nNested Branches:");
const nestedResult = await agent({ llm })
  .then({ prompt: "Is 42 > 20? YES or NO" })
  .branch(
    (h) => h[0].llmOutput?.includes("YES") || false,
    {
      true: (a) => a
        .then({ prompt: "Is 42 even? YES or NO" })
        .branch(
          (h2) => h2[h2.length - 1].llmOutput?.includes("YES") || false,
          {
            true: (a2) => a2.then({ prompt: "Say: 42 is large and even" }),
            false: (a2) => a2.then({ prompt: "Say: 42 is large and odd" })
          }
        ),
      false: (a) => a.then({ prompt: "Say: 42 is small" })
    }
  )
  .run();

console.log("Nested result:", nestedResult[nestedResult.length - 1].llmOutput);
