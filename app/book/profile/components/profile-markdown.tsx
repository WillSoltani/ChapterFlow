import { type ReactNode } from "react";

export function renderInlineMarkdown(text: string): ReactNode {
  const cleaned = text.replace(/^Pinned takeaway:\s*/i, "");
  const parts = cleaned.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold not-italic">{part.slice(2, -2)}</strong>
      : part
  );
}
