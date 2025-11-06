import { agent, llmOpenAI, mcp } from "../dist/volcano-sdk.js";

if (!process.env.GMAIL_ACCESS_TOKEN) {
  console.error('Error: GMAIL_ACCESS_TOKEN required');
  process.exit(1);
}

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5" });
const summaryLlm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" });

const gmail = mcp("http://localhost:3800/mcp", {
  auth: {
    type: 'bearer',
    token: process.env.GMAIL_ACCESS_TOKEN,
    ...(process.env.GMAIL_REFRESH_TOKEN && {
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET
    })
  }
});

console.log("Analyzing Gmail for spam...\n");

const results = await agent({ 
  llm,
  timeout: 300,
  instructions: `Analyze emails for spam indicators:
- Suspicious sender addresses or domains
- Urgent/threatening language ("Act now!", "Your account will be closed")
- Requests for passwords or personal info
- Poor grammar or spelling
- Promises of money/prizes
- Phishing attempts
- Marketing newsletters and promotional emails
- Generic greetings ("Dear Customer")

SAFEGUARDS:
- NEVER mark emails from the SAME DOMAIN as the recipient email address - these are internal emails, always legitimate
- NEVER mark billing/invoice/payment emails as spam
- When unsure, do not mark as spam

Be conservative.

When marking emails as spam, add the "SPAM DETECTED" label to the email in question.`
})
  .then({
    prompt: "Get all unread emails, analyze for spam, mark any spam with custom label 'SPAM DETECTED'",
    mcps: [gmail],
    maxToolIterations: 20,
    timeout: 300
  })
  .run();

const emailList = await results.ask(summaryLlm, 
  "List EVERY SINGLE email that was analyzed with sender and subject. Do NOT truncate or summarize - show the complete list."
);
console.log(emailList);

const spamList = await results.ask(summaryLlm, 
  "List emails marked as spam with sender and subject, or say 'No spam detected'"
);
console.log("\n" + spamList);
