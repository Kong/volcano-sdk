import { Highlight } from "prism-react-renderer";
import { customThemeLight } from "./code-theme";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const codeDemo = `import { agent, llmOpenAI, mcp } from "volcano-sdk";

const llm = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5-mini" });
const astro = mcp("http://localhost:3211/mcp");

const out = await agent({ llm })
  .then({
    prompt: "Determine the astrological sign for 1993-07-11.",
    mcps: [astro]
  })
  .then({ prompt: "Now write a one-line fortune for that sign." })
  .run();

console.log(out[0].toolCalls);  // which tools were used
console.log(out[1].llmOutput);   // fortune using step context`;

function Demo2() {
  const [copiedDemo, setCopiedDemo] = useState(false);

  const handleCopyDemo = async () => {
    try {
      await navigator.clipboard.writeText(codeDemo);
      setCopiedDemo(true);
      setTimeout(() => setCopiedDemo(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <section className="my-16 overflow-hidden">
      <div className="container flex flex-col gap-8 px-4 sm:px-0">
        <div className="flex grow flex-col">
          <div className="font-space-mono text-xl font-bold sm:text-4xl">
            MCP Native
          </div>
          <p className="py-2 text-base sm:text-xl">
            The agent finds the astrological sign via an MCP tool, then crafts a
            one-line fortune using the previous step's context.
          </p>
          <div className="overflow-hidden border-2">
            <div className="flex items-center gap-2 border-b-2 p-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="relative">
              <button
                onClick={handleCopyDemo}
                className="text-color-primary absolute top-2 right-2 z-10 p-2 transition-colors hover:bg-[#FF572D]/30"
                aria-label="Copy code"
              >
                {copiedDemo ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <Highlight
                theme={customThemeLight}
                code={codeDemo}
                language="typescript"
              >
                {({ style, tokens, getLineProps, getTokenProps }) => (
                  <pre
                    className="overflow-x-auto p-4 text-sm sm:text-base"
                    style={style}
                  >
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <div>
            <div className="font-space-mono text-lg font-bold sm:text-2xl pb-2">
              What's happening
            </div>
            <div className="flex items-start gap-4 py-2 text-sm font-bold sm:text-xl">
              <div className="bg-btn-primary flex h-8 w-8 flex-shrink-0 items-center justify-center p-3 text-white">
                1
              </div>
              <div className="flex min-w-0 flex-col">
                <span>Dynamic tool discovery</span>
                <p className="text-sm font-light">
                  Volcano fetches available MCP tools and names, caching with
                  TTL for speed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-2 text-sm font-bold sm:text-xl">
              <div className="bg-btn-primary flex h-8 w-8 flex-shrink-0 items-center justify-center p-3 text-white">
                2
              </div>
              <div className="flex min-w-0 flex-col">
                <span>Schema‑safe execution</span>
                <p className="text-sm font-light">
                  Arguments are validated against JSON Schema (Ajv) before the
                  tool runs.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-2 text-sm font-bold sm:text-xl">
              <div className="bg-btn-primary flex h-8 w-8 flex-shrink-0 items-center justify-center p-3 text-white">
                3
              </div>
              <div className="flex min-w-0 flex-col">
                <span>Step context</span>
                <p className="text-sm font-light">
                  The second step receives a compact summary of the prior answer
                  + recent tool results.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-2 text-sm font-bold sm:text-xl">
              <div className="bg-btn-primary flex h-8 w-8 flex-shrink-0 items-center justify-center p-3 text-white">
                4
              </div>
              <div className="flex min-w-0 flex-col">
                <span>Observability built‑in</span>
                <p className="text-sm font-light">
                  Each step records llmMs, mcp.ms, and a final run includes
                  totals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Demo2;
