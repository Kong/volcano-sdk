import { Highlight } from "prism-react-renderer";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

// Dark theme with black background and vibrant accent colors
const darkTheme = {
  plain: {
    color: "#ffffff",
    backgroundColor: "#000000",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#888888",
        fontStyle: "italic" as const,
      },
    },
    {
      types: ["keyword", "operator", "boolean", "null", "undefined"],
      style: {
        color: "#FF572D", // Vibrant orange-red
      },
    },
    {
      types: ["string", "char", "attr-value", "regex"],
      style: {
        color: "#FFDB29", // Bright yellow
      },
    },
    {
      types: ["function", "function-variable", "method"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["class-name", "type", "builtin"],
      style: {
        color: "#FFDB29", // Bright yellow
      },
    },
    {
      types: ["variable", "property", "constant"],
      style: {
        color: "#ffffff", // White
      },
    },
    {
      types: ["tag", "selector"],
      style: {
        color: "#FF572D", // Vibrant orange-red
      },
    },
    {
      types: ["attr-name"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["number"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["punctuation", "symbol"],
      style: {
        color: "#ffffff", // White
      },
    },
    {
      types: ["inserted"],
      style: {
        color: "#FFDB29",
      },
    },
    {
      types: ["deleted"],
      style: {
        color: "#FF572D",
      },
    },
  ],
};

// Light theme with white background and readable colors
const lightTheme = {
  plain: {
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata", "shebang", "hashbang"],
      style: {
        color: "#6b7280",
        fontStyle: "italic" as const,
      },
    },
    {
      types: [
        "keyword",
        "operator",
        "boolean",
        "null",
        "undefined",
        "important",
        "builtin",
        "shell-symbol",
        "bash",
        "function-name",
        "function",
      ],
      style: {
        color: "#FF572D", // bg-btn-primary color
      },
    },
    {
      types: ["string", "char", "attr-value", "regex", "url"],
      style: {
        color: "#059669", // Green
      },
    },
    {
      types: ["function", "function-variable", "method", "function-name"],
      style: {
        color: "#7c3aed", // Purple
      },
    },
    {
      types: ["class-name", "type", "builtin-class", "maybe-class-name"],
      style: {
        color: "#0284c7", // Blue
      },
    },
    {
      types: ["variable", "constant", "plain-text"],
      style: {
        color: "#1a1a1a", // Dark gray
      },
    },
    {
      types: ["property", "parameter", "argument"],
      style: {
        color: "#059669", // Green for parameters
      },
    },
    {
      types: ["tag", "selector"],
      style: {
        color: "#FF572D", // bg-btn-primary color
      },
    },
    {
      types: ["attr-name", "property-access"],
      style: {
        color: "#7c3aed", // Purple
      },
    },
    {
      types: ["number"],
      style: {
        color: "#0284c7", // Blue
      },
    },
    {
      types: ["punctuation", "symbol"],
      style: {
        color: "#374151", // Slightly darker gray
      },
    },
    {
      types: ["inserted"],
      style: {
        color: "#059669",
      },
    },
    {
      types: ["deleted"],
      style: {
        color: "#FF572D", // bg-btn-primary color
      },
    },
    // Catch-all for any unmatched tokens in bash/shell
    {
      types: ["plain", "text"],
      style: {
        color: "#1a1a1a",
      },
    },
  ],
};

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  className?: string;
  theme?: "light" | "dark";
}

export function CodeBlock({
  children,
  language = "typescript",
  title,
  showLineNumbers = false,
  className = "",
  theme = "light",
}: CodeBlockProps) {
  const selectedTheme = theme === "dark" ? darkTheme : lightTheme;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group relative my-4 sm:my-6 ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b px-3 py-2 sm:px-4">
          <span className="text-sm font-medium sm:text-base">{title}</span>
        </div>
      )}

      <div className="relative">
        <button
          onClick={copyToClipboard}
          className="text-color-primary absolute top-2 right-2 z-10 rounded-none p-1.5 transition-colors hover:bg-[#FF572D]/30 sm:p-2"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          ) : (
            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </button>

        <Highlight
          theme={selectedTheme}
          code={children.trim()}
          language={language}
        >
          {({
            className: highlightClassName,
            tokens,
            getLineProps,
            getTokenProps,
          }) => (
            <pre
              className={`${highlightClassName} overflow-x-auto rounded-none border-2 border-black p-3 pr-12 text-xs sm:p-4 sm:pr-20 sm:text-sm`}
              style={{
                backgroundColor: selectedTheme.plain.backgroundColor,
                color: selectedTheme.plain.color,
                lineHeight: "1.5",
              }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {showLineNumbers && (
                    <span className="mr-4 inline-block w-8 text-right select-none">
                      {i + 1}
                    </span>
                  )}
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
  );
}

// Pre-configured code block for inline code
export function InlineCode({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <code className={`rounded px-1.5 py-0.5 font-mono ${className}`}>
      {children}
    </code>
  );
}
