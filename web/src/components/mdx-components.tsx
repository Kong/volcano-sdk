import { CodeBlock, InlineCode } from "./ui/code-block";
import { Callout } from "./ui/callout";
import type { ReactNode, ReactElement } from "react";

// Type for MDX directive components
interface DirectiveProps {
  children: ReactNode;
  directiveLabel?: string;
}

// Type for code elements in pre blocks
interface CodeElement {
  props?: {
    className?: string;
    children?: string;
  };
}

// Custom table component for better styling and mobile responsiveness
// eslint-disable-next-line react-refresh/only-export-components
const Table = ({ children }: { children: ReactNode }) => (
  <div className="not-prose my-6 overflow-x-auto lg:my-8">
    <div className="inline-block min-w-full align-middle">
      <div className="overflow-hidden border-2 border-black sm:rounded-none">
        <table className="min-w-full border-collapse">{children}</table>
      </div>
    </div>
  </div>
);

// eslint-disable-next-line react-refresh/only-export-components
const THead = ({ children }: { children: ReactNode }) => (
  <thead className="border-b-2 bg-[#FF572D]/20">{children}</thead>
);

// eslint-disable-next-line react-refresh/only-export-components
const TBody = ({ children }: { children: ReactNode }) => (
  <tbody className="divide-y-2">{children}</tbody>
);

// eslint-disable-next-line react-refresh/only-export-components
const TR = ({ children }: { children: ReactNode }) => (
  <tr className="transition-colors hover:bg-[#FF572D]/5">{children}</tr>
);

// eslint-disable-next-line react-refresh/only-export-components
const TH = ({ children }: { children: ReactNode }) => (
  <th className="border-r-2 px-3 py-3 text-left text-xs font-bold tracking-wide uppercase last:border-r-0 sm:px-6 sm:py-4 sm:text-sm">
    {children}
  </th>
);

// eslint-disable-next-line react-refresh/only-export-components
const TD = ({ children }: { children: ReactNode }) => {
  // Check if content is a checkmark or similar emoji
  const content = String(children);
  const isEmoji = /^[✅❌➖✓✗]$/.test(content.trim());

  // Check if content has strong/bold element
  const hasBold =
    typeof children === "object" &&
    children &&
    "type" in (children as ReactElement) &&
    (children as ReactElement).type === "strong";

  return (
    <td
      className={`border-r-2 px-3 py-3 text-sm last:border-r-0 sm:px-6 sm:py-4 sm:text-base ${isEmoji ? "text-center text-lg sm:text-xl" : ""} ${hasBold ? "font-semibold" : ""}`}
    >
      {children}
    </td>
  );
};

// Custom components for MDX
export const mdxComponents = {
  // Table components
  table: Table,
  thead: THead,
  tbody: TBody,
  tr: TR,
  th: TH,
  td: TD,
  // Map code blocks to our custom CodeBlock component
  pre: ({ children, ...props }: { children: ReactNode }) => {
    // Extract code content and language from the pre/code structure
    if (typeof children === "object" && children && "props" in children) {
      const codeElement = children as CodeElement;
      const className = codeElement.props?.className || "";
      const language = className.replace(/language-/, "");
      const code = codeElement.props?.children || "";

      return (
        <div className="not-prose">
          <CodeBlock
            language={language || "typescript"}
            showLineNumbers={false}
            theme="light"
          >
            {code}
          </CodeBlock>
        </div>
      );
    }
    return <pre {...props}>{children}</pre>;
  },

  // Map inline code to our custom InlineCode component
  code: ({ children }: { children: ReactNode }) => {
    const code = typeof children === "string" ? children : String(children);
    return <InlineCode>{code}</InlineCode>;
  },

  // Strong/bold text
  strong: ({ children }: { children: ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),

  // Directive components (:::note, :::warning, etc.)
  NoteDirective: ({ children, directiveLabel }: DirectiveProps) => (
    <Callout type="note" title={directiveLabel}>
      {children}
    </Callout>
  ),
  WarningDirective: ({ children, directiveLabel }: DirectiveProps) => (
    <Callout type="warning" title={directiveLabel}>
      {children}
    </Callout>
  ),
  TipDirective: ({ children, directiveLabel }: DirectiveProps) => (
    <Callout type="tip" title={directiveLabel}>
      {children}
    </Callout>
  ),
  CautionDirective: ({ children, directiveLabel }: DirectiveProps) => (
    <Callout type="caution" title={directiveLabel}>
      {children}
    </Callout>
  ),
  InfoDirective: ({ children, directiveLabel }: DirectiveProps) => (
    <Callout type="info" title={directiveLabel}>
      {children}
    </Callout>
  ),
};
