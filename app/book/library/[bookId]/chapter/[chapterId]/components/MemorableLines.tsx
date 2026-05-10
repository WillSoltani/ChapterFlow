"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { V21MemorableLine } from "@/app/book/lib/v21-adapter";

type MemorableLinesProps = {
  lines: V21MemorableLine[];
};

export function MemorableLines({ lines }: MemorableLinesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (lines.length === 0) return null;

  const copyLine = async (text: string, index: number) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
    } catch {
      // clipboard may be unavailable; ignore
    }
  };

  return (
    <section className="cr-memorable-lines rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-5 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-(--cr-text-secondary)">
        Lines worth keeping
      </h3>
      <ul className="mt-3 space-y-3">
        {lines.map((line, index) => (
          <li
            key={`${index}-${line.text.slice(0, 24)}`}
            className="flex items-start justify-between gap-3 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-3"
          >
            <blockquote className="text-sm leading-relaxed text-(--cr-text-primary)">
              &ldquo;{line.text}&rdquo;
            </blockquote>
            <button
              type="button"
              onClick={() => copyLine(line.text, index)}
              className="shrink-0 rounded-lg border border-(--cr-glass-border) p-2 text-(--cr-text-secondary) transition hover:border-(--cr-glass-border-teal) hover:text-(--cr-accent)"
              aria-label={copiedIndex === index ? "Copied" : "Copy quote"}
            >
              {copiedIndex === index ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
