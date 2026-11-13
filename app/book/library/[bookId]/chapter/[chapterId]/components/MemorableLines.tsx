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
    <section className="cr-memorable-lines">
      <h3 className="text-cf-caption font-medium uppercase tracking-[0.16em] text-(--cr-text-secondary)">
        Lines worth keeping
      </h3>
      <ul className="mt-2 divide-y divide-(--cr-glass-border)">
        {lines.map((line, index) => (
          <li
            key={`${index}-${line.text.slice(0, 24)}`}
            className="flex items-start justify-between gap-3 py-3"
          >
            <blockquote className="cr-reading-content pt-1.5 text-(--cr-text-primary)">
              &ldquo;{line.text}&rdquo;
            </blockquote>
            <button
              type="button"
              onClick={() => copyLine(line.text, index)}
              className="-mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-(--cr-text-secondary) transition-colors hover:bg-(--cr-bg-surface-3) hover:text-(--cr-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
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
