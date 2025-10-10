import { Highlight } from "prism-react-renderer";
import { customThemeLight } from "./code-theme";
import { Check, Copy } from "lucide-react";
import { useState, useEffect, useRef } from "react";

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
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

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
    <section ref={sectionRef} className="my-16 overflow-hidden">
      <div className="container flex flex-col gap-8 px-4 sm:px-0">
        <div
          className={`flex grow flex-col transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="font-space-mono text-xl font-bold sm:text-4xl">
            MCP Native
          </div>
          <p className="py-2 text-base sm:text-xl">
            The agent finds the astrological sign via an MCP tool, then crafts a
            one-line fortune using the previous step's context.
          </p>

          {/* Code Block */}
          <div className="overflow-hidden border-1 border-black shadow-lg">
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b-1 border-black bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="font-mono text-xs text-slate-500 font-medium">
                mcp-demo.ts
              </div>
            </div>

            {/* Code Content */}
            <div className="relative bg-white">
              {/* Copy Button */}
              <button
                onClick={handleCopyDemo}
                className="text-color-primary absolute top-3 right-3 z-10 p-2.5 transition-all duration-300 hover:scale-110 hover:bg-[#FF572D]/10 active:scale-95 border-1 border-black"
                aria-label="Copy code"
              >
                {copiedDemo ? (
                  <Check className="h-4 w-4 animate-in zoom-in duration-200" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>

              {/* Syntax Highlighted Code */}
              <Highlight
                theme={customThemeLight}
                code={codeDemo}
                language="typescript"
              >
                {({ style, tokens, getLineProps, getTokenProps }) => (
                  <pre
                    className="overflow-x-auto p-4 sm:p-6 text-sm sm:text-base leading-relaxed bg-white"
                    style={{ ...style, backgroundColor: 'white' }}
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
        <div
          className={`w-full overflow-hidden transition-all duration-700 delay-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div>
            <div className="font-space-mono text-lg font-bold sm:text-2xl pb-6">
              What's happening
            </div>
            <div className="relative flex flex-col gap-4">
              <div className="group relative flex items-start gap-4 border-1 border-black  hover:outline-2  hover:outline-offset-[-2px]">
                <div className="flex flex-col p-5 gap-3 w-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-btn-primary relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center text-lg font-bold text-white shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md">
                      1
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 flex-1">
                      <span className="text-base font-bold sm:text-lg">Dynamic tool discovery</span>
                      <p className="text-sm text-slate-600 sm:text-base leading-relaxed">
                        Volcano connects to the <code className="px-1.5 py-0.5 bg-slate-100 text-[#FF572D] text-xs sm:text-sm font-mono border border-slate-200">astro</code> MCP server at runtime and discovers available tools. The LLM automatically calls what it needs. No manual setup required.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group relative flex items-start gap-4 border-1 border-black  hover:outline-2  hover:outline-offset-[-2px]">
                <div className="flex flex-col p-5 gap-3 w-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-btn-primary relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center text-lg font-bold text-white shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md">
                      2
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 flex-1">
                      <span className="text-base font-bold sm:text-lg">Schema‑safe execution</span>
                      <p className="text-sm text-slate-600 sm:text-base leading-relaxed">
                        The MCP server provides a <code className="px-1.5 py-0.5 bg-slate-100 text-[#FF572D] text-xs sm:text-sm font-mono border border-slate-200">JSON Schema</code> defining valid arguments for each tool. Before calling any tool, the LLM's arguments are validated against this schema. Invalid calls fail fast.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group relative flex items-start gap-4 border-1 border-black  hover:outline-2  hover:outline-offset-[-2px]">
                <div className="flex flex-col p-5 gap-3 w-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-btn-primary relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center text-lg font-bold text-white shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md">
                      3
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 flex-1">
                      <span className="text-base font-bold sm:text-lg">Step context</span>
                      <p className="text-sm text-slate-600 sm:text-base leading-relaxed">
                        Each subsequent <code className="px-1.5 py-0.5 bg-slate-100 text-[#FF572D] text-xs sm:text-sm font-mono border border-slate-200">.then()</code> receives the previous step's output as context. The fortune-writing step automatically gets the astrological sign to craft a personalized result.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group relative flex items-start gap-4 border-1 border-black  hover:outline-2  hover:outline-offset-[-2px]">
                <div className="flex flex-col p-5 gap-3 w-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-btn-primary relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center text-lg font-bold text-white shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md">
                      4
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 flex-1">
                      <span className="text-base font-bold sm:text-lg">Observability built‑in</span>
                      <p className="text-sm text-slate-600 sm:text-base leading-relaxed">
                        Access telemetry data from every step with fine-grained control over how it's collected and relayed. Monitor timing, token usage, and tool calls to debug or log your agent's behavior.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Demo2;
