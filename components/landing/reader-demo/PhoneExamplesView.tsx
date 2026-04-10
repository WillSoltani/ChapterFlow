"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEMO_EXAMPLES } from "./demoChapter";

interface PhoneExamplesViewProps {
  isActive: boolean;
}

const SCOPE_ICONS: Record<string, string> = {
  work: "\uD83D\uDCBC",
  school: "\uD83C\uDF93",
  personal: "\uD83C\uDFE0",
};

/**
 * Compact phone-scale mirror of the in-app ExamplesList.
 *
 * Shows 2 of the 3 examples (work + personal) to fit the phone, with
 * the same `cr-glass-card` styling and rotating treatments. While the
 * phase is active, the visible card auto-cycles every ~3 seconds so
 * the viewer sees both scenarios without scrolling.
 */
export function PhoneExamplesView({ isActive }: PhoneExamplesViewProps) {
  const examples = DEMO_EXAMPLES.slice(0, 2);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-cycle Work / Personal while phase is active
  useEffect(() => {
    if (!isActive) {
      setActiveIndex(0);
      return;
    }
    const t = setTimeout(() => setActiveIndex((i) => (i + 1) % examples.length), 3200);
    return () => clearTimeout(t);
  }, [isActive, activeIndex, examples.length]);

  return (
    <div
      className="space-y-2"
      style={{
        padding: "0 12px",
        animation: isActive ? "cr-card-enter 350ms ease-out" : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p
          className="text-[7px] font-bold uppercase"
          style={{
            color: "var(--cr-accent)",
            letterSpacing: "0.12em",
          }}
        >
          Examples
        </p>
        <p
          className="text-[7px]"
          style={{ color: "var(--cr-text-disabled)" }}
        >
          {activeIndex + 1} / {examples.length}
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {examples.map((example, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={example.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className="text-[7px] font-bold uppercase rounded-full"
              style={{
                padding: "2px 7px",
                background: active
                  ? "var(--cr-accent-muted)"
                  : "transparent",
                border: `1px solid ${active ? "var(--cr-glass-border-teal)" : "var(--cr-glass-border)"}`,
                color: active ? "var(--cr-accent)" : "var(--cr-text-secondary)",
                letterSpacing: "0.05em",
              }}
            >
              {example.scope}
            </button>
          );
        })}
      </div>

      {/* Animated card swap */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {examples.map((example, i) =>
            i === activeIndex ? (
              <motion.article
                key={example.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="cr-glass-card overflow-hidden"
                style={{
                  borderLeft: i % 2 === 0
                    ? "2px solid var(--cr-accent)"
                    : undefined,
                  background: i % 2 === 1
                    ? "rgba(77, 182, 172, 0.04)"
                    : "var(--cr-glass-card)",
                  padding: 0,
                  borderRadius: 8,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--cr-glass-border)",
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 10 }}>
                      {SCOPE_ICONS[example.scope] ?? "📌"}
                    </span>
                    <span
                      className="text-[6.5px] font-bold uppercase"
                      style={{
                        color: "var(--cr-text-disabled)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {example.scope}
                    </span>
                  </div>
                  <h3
                    className="text-[10px] font-bold mt-0.5"
                    style={{
                      color: "var(--cr-text-heading)",
                      lineHeight: 1.3,
                    }}
                  >
                    {example.title}
                  </h3>
                </div>

                {/* Body */}
                <div style={{ padding: "8px 10px", display: "grid", gap: 6 }}>
                  <div>
                    <p
                      className="text-[6.5px] font-bold uppercase mb-0.5"
                      style={{
                        color: "var(--cr-text-secondary)",
                        letterSpacing: "0.12em",
                      }}
                    >
                      Scenario
                    </p>
                    <p
                      className="text-[8px]"
                      style={{
                        color: "var(--cr-text-primary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {example.scenario}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[6.5px] font-bold uppercase mb-0.5"
                      style={{
                        color: "var(--cr-accent)",
                        letterSpacing: "0.12em",
                      }}
                    >
                      What To Do
                    </p>
                    <p
                      className="text-[8px]"
                      style={{
                        color: "var(--cr-text-primary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {example.whatToDo}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[6.5px] font-bold uppercase mb-0.5"
                      style={{
                        color: "var(--cr-text-secondary)",
                        letterSpacing: "0.12em",
                      }}
                    >
                      Why It Matters
                    </p>
                    <p
                      className="text-[8px] italic"
                      style={{
                        color: "var(--cr-text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {example.whyItMatters}
                    </p>
                  </div>
                </div>
              </motion.article>
            ) : null
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
