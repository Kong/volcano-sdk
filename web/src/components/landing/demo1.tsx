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
import { useState, useEffect, useRef } from "react";

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
    <section
      ref={sectionRef}
      className="overflow-hidden"
      id="demo"
    >
      <div className="container flex flex-col px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24 xl:gap-10">
        {/* Title and Code Block Section */}
        <div
          className={`mb-8 flex flex-1 flex-col xl:mb-0 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          <div className="font-space-mono text-2xl font-bold sm:text-4xl lg:text-5xl">
            Multi-Provider Workflow
          </div>
          <p className="py-3 text-base sm:text-xl">
            Use different LLMs for different steps.
          </p>

          {/* Code Block with Glassmorphism and Animated Border */}
          <div className="relative group">
            {/* Animated gradient border background */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF572D] via-[#FF8C5C] to-[#FF572D] opacity-75 group-hover:opacity-100 blur-sm transition duration-500 animate-gradient-xy" />

            {/* Code container */}
            <div className="relative overflow-hidden border-2 border-transparent backdrop-blur-xl bg-slate-900/90 shadow-2xl">
              {/* Terminal Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-700/50 bg-slate-800/50 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/50" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-yellow-500/50" />
                  <div className="h-3 w-3 rounded-full bg-green-500 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-green-500/50" />
                </div>
                <div className="font-mono text-xs text-slate-400">
                  workflow.ts
                </div>
              </div>

              {/* Code Content */}
              <div className="relative">
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="text-color-primary absolute top-3 right-3 z-10 p-2.5 transition-all duration-300 hover:scale-110 hover:bg-[#FF572D]/20 hover:shadow-lg hover:shadow-[#FF572D]/30 active:scale-95 backdrop-blur-sm bg-slate-800/50 border border-[#FF572D]/30"
                  aria-label="Copy code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 animate-in zoom-in duration-200" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>

                {/* Syntax Highlighted Code */}
                <Highlight
                  theme={customThemeDark}
                  code={codeExample}
                  language="typescript"
                >
                  {({ style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className="overflow-x-auto p-4 sm:p-6 text-sm sm:text-base leading-relaxed"
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

                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#FF572D]/5 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-auto xl:flex-shrink-0">
          <div className="font-space-mono pb-4 text-lg font-bold sm:text-2xl xl:pb-8">
            Advanced Patterns
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-2">
              <Rows3 className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-lg">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.parallel()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-lg">
                  Run steps simultaneously
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Split className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-lg">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.branch()/.switch()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-lg">
                  Conditional routing
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Repeat2 className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-lg">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.while()/.forEach</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-lg">
                  Loop constructs
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Bot className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-lg">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.runAgent()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-lg">
                  Compose sub-agents
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Radio className="text-color-primary h-8 w-8" />
              <div className="flex flex-col items-start">
                <p className="flex items-start gap-2 text-sm sm:text-lg">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <code>.stream()</code>
                  </span>
                </p>
                <p className="py-1 pl-3 text-sm text-slate-600 sm:text-lg">
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

      {/* CSS for animated gradient border */}
      <style>{`
        @keyframes gradient-xy {
          0%, 100% {
            background-position: 0% 50%;
            background-size: 400% 400%;
          }
          50% {
            background-position: 100% 50%;
            background-size: 400% 400%;
          }
        }
        .animate-gradient-xy {
          animation: gradient-xy 3s ease infinite;
        }
      `}</style>
    </section>
  );
}

export default Demo1;
