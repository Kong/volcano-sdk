import { agent, llmOpenAI } from "../dist/volcano-sdk.js";

const llm = llmOpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!, 
  model: "gpt-4o-mini" 
});

console.log("1. Binary Branch (If/Else)");
const number = 17;

const binaryResult = await agent({ llm })
  .then({ prompt: `Is ${number} prime? Reply YES or NO only.` })
  .branch(
    (history) => history[0].llmOutput?.toUpperCase().includes("YES") || false,
    {
      true: (a) => a.then({ prompt: `Say: ${number} is prime!` }),
      false: (a) => a.then({ prompt: `Say: ${number} is not prime` })
    }
  )
  .run();

console.log(binaryResult[1].llmOutput);

console.log("\n2. Multi-Way Switch");
const userMessage = "I need help resetting my password";

const switchResult = await agent({ llm })
  .then({ prompt: `Classify intent: "${userMessage}". Reply: BILLING, TECHNICAL, ACCOUNT, or GENERAL` })
  .switch(
    (history) => history[0].llmOutput?.toUpperCase().trim() || '',
    {
      'BILLING': (a) => a.then({ prompt: "Route to billing department" }),
      'TECHNICAL': (a) => a.then({ prompt: "Route to tech support" }),
      'ACCOUNT': (a) => a.then({ prompt: "Send password reset link" }),
      'GENERAL': (a) => a.then({ prompt: "Route to general support" }),
      default: (a) => a.then({ prompt: "Unable to classify, escalate to human" })
    }
  )
  .run();

console.log("Classification:", switchResult[0].llmOutput);
console.log("Action:", switchResult[1].llmOutput);

console.log("\n3. Branch After Parallel Analysis");
const text = "This product is amazing but the price is too high";

const parallelBranchResult = await agent({ llm })
  .parallel({
    sentiment: { prompt: `Sentiment of "${text}"? Positive, Negative, or Neutral` },
    topic: { prompt: `Main topic of "${text}"? Product, Price, or Service` }
  })
  .branch(
    (h) => h[0].parallel?.sentiment.llmOutput?.includes("Positive") || false,
    {
      true: (a) => a.then({ prompt: "Generate thank-you response" }),
      false: (a) => a.then({ prompt: "Generate addressing concerns response" })
    }
  )
  .run();

console.log("Sentiment:", parallelBranchResult[0].parallel?.sentiment.llmOutput);
console.log("Topic:", parallelBranchResult[0].parallel?.topic.llmOutput);
console.log("Response:", parallelBranchResult[1].llmOutput);
