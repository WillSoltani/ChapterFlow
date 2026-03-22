"use client";

import { motion } from "framer-motion";
import { SessionBreakdown } from "./SessionBreakdown";
import { SessionDots } from "@/components/ui/SessionDots";
import { DashboardBookCover } from "@/components/ui/DashboardBookCover";

const ease = [0.22, 1, 0.36, 1] as const;

interface BookData {
  title: string;
  author: string;
  chapter: number;
  totalChapters: number;
  progress: number;
  gradient: string;
}

interface HeroBookCardProps {
  book: BookData;
  isNewUser?: boolean;
}

export function HeroBookCard({ book, isNewUser = false }: HeroBookCardProps) {
  return (
    <motion.div
      className="overflow-hidden"
      style={{
        border: "1px solid var(--border-accent)",
        background: "rgba(255,255,255,0.02)",
        backgroundImage:
          "linear-gradient(135deg, rgba(79,139,255,0.03) 0%, transparent 50%)",
        boxShadow: "var(--shadow-hero), 0 0 60px rgba(79,139,255,0.04)",
        borderRadius: 28,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease }}
    >
      <div className="flex flex-col lg:flex-row">
        {/* LEFT ZONE — Book info + CTA */}
        <div className="flex-1 p-6 md:p-8">
          {/* Status pill */}
          <div
            className="inline-flex items-center gap-[5px] rounded-full px-3 py-1"
            style={{
              background: isNewUser
                ? "rgba(79,139,255,0.06)"
                : "rgba(45,212,191,0.06)",
              border: `1px solid ${
                isNewUser
                  ? "rgba(79,139,255,0.12)"
                  : "rgba(45,212,191,0.12)"
              }`,
            }}
          >
            {isNewUser ? (
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <rect
                  x={3}
                  y={3}
                  width={18}
                  height={18}
                  rx={4}
                  stroke="var(--accent-blue)"
                  strokeWidth={2}
                />
                <path
                  d="M8 12h8M12 8v8"
                  stroke="var(--accent-blue)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: "var(--accent-teal)",
                  boxShadow: "0 0 6px var(--accent-teal-glow)",
                }}
              />
            )}
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{
                color: isNewUser
                  ? "var(--accent-blue)"
                  : "var(--accent-teal)",
              }}
            >
              {isNewUser ? "Ready to Start" : "In Progress"}
            </span>
          </div>

          {/* Book row */}
          <div className="mt-4 flex items-start gap-5">
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease }}
            >
              <DashboardBookCover
                title={book.title}
                gradient={book.gradient}
                width={80}
                height={112}
              />
            </motion.div>

            <div className="min-w-0 flex-1">
              <h2
                className="font-(family-name:--font-display) text-[20px] font-bold md:text-[24px]"
                style={{ color: "var(--text-heading)" }}
              >
                {book.title}
              </h2>
              <p
                className="mt-0.5 text-[13px]"
                style={{ color: "var(--accent-blue)" }}
              >
                by {book.author}
              </p>

              {/* Chapter progress */}
              <div className="mt-3.5 flex items-center gap-2.5">
                <span
                  className="text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Chapter {book.chapter} of {book.totalChapters}
                </span>
                <div className="flex-1" style={{ maxWidth: 180 }}>
                  <div
                    className="h-1 overflow-hidden rounded-sm"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <motion.div
                      className="h-full rounded-sm"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--accent-blue), var(--accent-teal))",
                      }}
                      initial={{ width: "0%" }}
                      animate={{ width: `${book.progress}%` }}
                      transition={{
                        duration: 1.2,
                        ease: "easeOut",
                        delay: 0.4,
                      }}
                    />
                  </div>
                </div>
                <span
                  className="font-(family-name:--font-jetbrains) text-[12px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {book.progress}%
                </span>
              </div>

              {/* Session flow dots */}
              <div className="mt-4">
                <SessionDots currentStep={0} completedSteps={[]} />
                <p
                  className="mt-1.5 text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  ~12 min session
                </p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-6">
            <button
              className="cta-shine group cursor-pointer rounded-[var(--radius-md-val)] px-9 py-4 text-[16px] font-semibold text-white transition-all hover:scale-[1.03]"
              style={{
                background: "var(--accent-green)",
                boxShadow: "var(--shadow-glow-green)",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--accent-green-hover)";
                e.currentTarget.style.boxShadow =
                  "0 0 32px rgba(52,211,153,0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "var(--accent-green)";
                e.currentTarget.style.boxShadow = "var(--shadow-glow-green)";
              }}
            >
              {isNewUser
                ? "Begin Chapter 1"
                : `Start Chapter ${book.chapter}`}{" "}
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </button>
            <p
              className="mt-2 text-[12px] italic"
              style={{ color: "var(--text-muted)" }}
            >
              {isNewUser
                ? "Your reading journey starts with one chapter."
                : "No pressure — pick up right where you left off."}
            </p>
          </div>
        </div>

        {/* RIGHT ZONE — Session Breakdown */}
        <div
          className="border-t lg:border-t-0 lg:border-l"
          style={{
            borderColor: "var(--border-subtle)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <div className="lg:w-[240px]">
            <SessionBreakdown />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
