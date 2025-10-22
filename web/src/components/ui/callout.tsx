import type { ReactNode } from "react";

interface CalloutProps {
  type?: "note" | "warning" | "tip" | "caution" | "info";
  title?: string;
  children: ReactNode;
}

export function Callout({ type = "note", title, children }: CalloutProps) {
  const styles = {
    note: "border-blue-500 bg-blue-50/50",
    warning: "border-yellow-500 bg-yellow-50/50",
    tip: "border-green-500 bg-green-50/50",
    caution: "border-red-500 bg-red-50/50",
    info: "border-blue-500 bg-blue-50/50",
  };

  return (
    <div className={`my-4 border-l-4 p-4 ${styles[type]}`}>
      {title && <div className="mb-2 font-bold">{title}</div>}
      <div>{children}</div>
    </div>
  );
}
