import { MDXProvider } from "@mdx-js/react";
import type { ReactNode } from "react";
import { Highlight, themes } from "prism-react-renderer";

const components = {
  pre: ({ children }: any) => {
    const code = children?.props?.children || "";
    const language =
      children?.props?.className?.replace("language-", "") || "typescript";

    return (
      <Highlight theme={themes.vsDark} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto rounded-lg p-4`}
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
    );
  },
  code: ({ children }: any) => (
    <code className="rounded px-1.5 py-0.5">{children}</code>
  ),
};

export function MDXProviderWrapper({ children }: { children: ReactNode }) {
  return <MDXProvider components={components}>{children}</MDXProvider>;
}
