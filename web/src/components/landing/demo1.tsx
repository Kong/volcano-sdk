import { Link } from "@tanstack/react-router";
import {
  Bot,
  Check,
  ChevronRight,
  Copy,
  Radio,
  Repeat2,
  Rows3,
  Split,
} from "lucide-react";
import { Highlight } from "prism-react-renderer";
import { customThemeDark } from "./code-theme";
import { useState } from "react";

const codeExample = `import { agent, llmOpenAI, llmAnthropic, llmMistral } from "volcano-sdk";

const gpt = llmOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const claude = llmAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const mistral = llmMistral({ apiKey: process.env.MISTRAL_API_KEY! });

await agent()
  .then({ llm: gpt, prompt: "Extract data from report" })
  .then({ llm: claude, prompt: "Analyze for patterns" })
  .then({ llm: mistral, prompt: "Write creative summary" })
  .run();`;

function Demo1() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <section className="overflow-hidden" id="demo">
      <div className="container flex flex-col px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24 xl:flex-row xl:gap-10">
        <div className="mb-8 flex flex-1 flex-col xl:mb-0">
          <div className="font-space-mono text-2xl font-bold sm:text-4xl lg:text-5xl">
            Multi-Provider Workflow
          </div>
          <p className="py-3 text-base sm:text-xl">
            Use different LLMs for different steps.
          </p>
          <div className="overflow-hidden border-2">
            <div className="flex items-center gap-2 border-b-2 p-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="relative">
              <button
                onClick={handleCopy}
                className="text-color-primary absolute top-2 right-2 z-10 p-2 transition-colors hover:bg-[#FF572D]/30"
                aria-label="Copy code"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <Highlight
                theme={customThemeDark}
                code={codeExample}
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
        <div className="w-full xl:w-auto xl:flex-shrink-0">
          <div className="font-space-mono pb-4 text-lg font-bold sm:text-2xl xl:pb-8">
            Advanced Patterns
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Rows3 className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-xl">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.parallel()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-xl">
                  Run steps simultaneously
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Split className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-xl">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.branch()/.switch()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-xl">
                  Conditional routing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Repeat2 className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-xl">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.while()/.forEach</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-xl">
                  Loop constructs
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Bot className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-xl">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.runAgent()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-xl">
                  Compose sub-agents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Radio className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-xl">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.stream()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-xl">
                  Real-time step results
                </p>
              </div>
            </div>
          </div>
          <Link
            to="/docs/patterns"
            className="text-color-primary flex items-center gap-2 py-4 text-base font-medium sm:text-xl"
          >
            Explore Advanced Patterns
            <ChevronRight />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Demo1;
