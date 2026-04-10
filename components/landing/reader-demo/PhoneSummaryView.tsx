"use client";

import { BookmarkPlus } from "lucide-react";
import {
  DEMO_ACTIVATION_PROMPT_BY_DEPTH,
  DEMO_KEY_QUOTE,
  DEMO_SUMMARY_BY_DEPTH,
} from "./demoChapter";

interface PhoneSummaryViewProps {
  isActive: boolean;
}

/**
 * Compact phone-scale mirror of the in-app SummaryCard structure.
 *
 * Uses the same `cr-glass-reading` and `cr-takeaway-card` classes as
 * the real reader, just sized for a 250-290px phone. We render a
 * small subset of content (1 paragraph, 2 takeaways, 1 key quote)
 * because the phone can't fit everything.
 */
export function PhoneSummaryView({ isActive }: PhoneSummaryViewProps) {
  const blocks = DEMO_SUMMARY_BY_DEPTH.standard;
  const paragraph = blocks.find((b) => b.type === "paragraph");
  const bullets = blocks
    .filter((b): b is Extract<typeof blocks[number], { type: "bullet" }> => b.type === "bullet")
    .slice(0, 2);
  const activation = DEMO_ACTIVATION_PROMPT_BY_DEPTH.standard;

  return (
    <div
      className="space-y-3"
      style={{
        padding: "0 12px",
        animation: isActive ? "cr-card-enter 350ms ease-out" : undefined,
      }}
    >
      {/* Activation prompt */}
      {activation && (
        <section
          className="rounded-lg"
          style={{
            border: "1px solid rgba(77, 182, 172, 0.2)",
            background: "var(--cr-accent-muted)",
            padding: "8px 10px",
          }}
        >
          <p
            className="text-[7px] font-bold uppercase"
            style={{
              color: "var(--cr-accent)",
              letterSpacing: "0.08em",
            }}
          >
            Before You Read
          </p>
          <p
            className="text-[8px] mt-1"
            style={{
              color: "var(--cr-text-primary)",
              lineHeight: 1.6,
            }}
          >
            {activation}
          </p>
        </section>
      )}

      {/* Main Summary section — uses cr-glass-reading like the real reader */}
      <section
        className="cr-glass-reading"
        style={{ padding: "12px", borderRadius: 10 }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p
            className="text-[7px] font-bold uppercase"
            style={{
              color: "var(--cr-text-secondary)",
              letterSpacing: "0.16em",
            }}
          >
            Summary
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-md"
            style={{
              border: "1px solid var(--cr-glass-border-teal)",
              background: "var(--cr-accent-muted)",
              color: "var(--cr-accent)",
              padding: "2px 6px",
              fontSize: "7px",
              fontWeight: 600,
            }}
          >
            <BookmarkPlus className="h-2 w-2" />
            Save
          </span>
        </div>
        <h2
          className="text-[11px] font-bold mb-1.5"
          style={{
            color: "var(--cr-text-heading)",
            letterSpacing: "-0.01em",
          }}
        >
          Chapter Breakdown
        </h2>
        {paragraph && paragraph.type === "paragraph" && (
          <p
            className="text-[9px]"
            style={{
              color: "var(--cr-text-primary)",
              lineHeight: 1.6,
              fontWeight: 450,
            }}
          >
            {paragraph.text}
          </p>
        )}
      </section>

      {/* Key Takeaways header */}
      <div className="flex items-center gap-2">
        <div
          className="h-px flex-1"
          style={{ background: "var(--cr-glass-border)" }}
        />
        <p
          className="text-[7px] font-bold uppercase"
          style={{
            color: "var(--cr-text-secondary)",
            letterSpacing: "0.15em",
          }}
        >
          Key Takeaways
        </p>
        <div
          className="h-px flex-1"
          style={{ background: "var(--cr-glass-border)" }}
        />
      </div>

      {/* Numbered takeaway cards (uses cr-takeaway-card class) */}
      <div className="space-y-2">
        {bullets.map((bullet, i) => (
          <article
            key={bullet.id}
            className="cr-takeaway-card"
            style={{
              padding: "10px",
              borderRadius: 8,
              animation: isActive
                ? `cr-card-enter 300ms ease-out ${i * 80}ms both`
                : undefined,
            }}
          >
            <div className="flex gap-2">
              <div
                className="flex shrink-0 items-center justify-center rounded-full font-bold"
                style={{
                  width: 18,
                  height: 18,
                  background: "var(--cr-accent)",
                  color: "var(--cr-text-inverse)",
                  fontSize: "8px",
                }}
              >
                {i + 1}
              </div>
              <p
                className="text-[8.5px] font-semibold flex-1"
                style={{
                  color: "var(--cr-text-heading)",
                  lineHeight: 1.45,
                }}
              >
                {bullet.text}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Key Quote with large quotation mark */}
      <section
        className="cr-glass-card relative overflow-hidden"
        style={{
          borderLeft: "3px solid var(--cr-accent)",
          padding: "10px 10px 10px 14px",
          borderRadius: 8,
        }}
      >
        <span
          className="absolute select-none pointer-events-none"
          style={{
            top: -4,
            left: 6,
            fontSize: 32,
            lineHeight: 1,
            color: "var(--cr-accent)",
            opacity: 0.2,
            fontFamily: "var(--font-display)",
          }}
          aria-hidden="true"
        >
          &ldquo;
        </span>
        <p
          className="text-[7px] font-bold uppercase mb-1"
          style={{
            color: "var(--cr-accent)",
            letterSpacing: "0.1em",
          }}
        >
          Key Quote
        </p>
        <p
          className="text-[8.5px] italic relative"
          style={{
            color: "var(--cr-text-heading)",
            lineHeight: 1.55,
            fontWeight: 450,
          }}
        >
          &ldquo;{DEMO_KEY_QUOTE}&rdquo;
        </p>
      </section>
    </div>
  );
}
