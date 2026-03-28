"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";

interface ProInsightsPreviewProps {
  isPro: boolean;
}

function BlurredChart({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="relative flex flex-col items-center justify-center rounded-xl p-6 overflow-hidden"
      style={{
        background: "var(--cf-surface-muted)",
        border: "1px solid var(--cf-border)",
        minHeight: 140,
      }}
      whileHover={{
        y: -2,
        borderColor: "rgba(139,92,246,0.25)",
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Blurred chart placeholder */}
      <div
        className="pointer-events-none"
        style={{
          filter: "blur(6px)",
          opacity: 0.25,
        }}
      >
        {children}
      </div>

      {/* Frosted glass overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          background: "rgba(11,14,20,0.4)",
        }}
      >
        <Lock className="h-6 w-6" style={{ color: "var(--text-secondary)", width: 24, height: 24 }} />
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-heading)" }}
        >
          {label}
        </span>
      </div>
    </motion.div>
  );
}

export function ProInsightsPreview({ isPro }: ProInsightsPreviewProps) {
  const prefersReduced = useReducedMotion();

  // Only show for free users
  if (isPro) return null;

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(167,139,250,0.12)",
        boxShadow: "var(--cf-shadow-sm)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <h2
        className="text-lg font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        Unlock Deeper Insights
      </h2>

      {/* Preview grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Comprehension Trend */}
        <BlurredChart label="Comprehension Trend">
          <svg width="100" height="50" viewBox="0 0 100 50">
            <polyline
              fill="none"
              stroke="var(--cf-accent)"
              strokeWidth="2"
              points="0,40 20,35 40,25 60,30 80,15 100,10"
            />
          </svg>
        </BlurredChart>

        {/* Topic Mastery */}
        <BlurredChart label="Topic Mastery">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <polygon
              fill="none"
              stroke="rgba(52,211,153,0.3)"
              strokeWidth="1"
              points="40,5 70,25 60,60 20,60 10,25"
            />
            <polygon
              fill="rgba(52,211,153,0.2)"
              stroke="var(--cf-success-text)"
              strokeWidth="1.5"
              points="40,18 58,30 52,50 28,50 22,30"
            />
          </svg>
        </BlurredChart>

        {/* Peer Benchmarking */}
        <BlurredChart label="Peer Benchmarking">
          <svg width="100" height="50" viewBox="0 0 100 50">
            <rect x="5" y="30" width="15" height="20" fill="var(--cf-accent)" opacity="0.4" rx="2" />
            <rect x="25" y="20" width="15" height="30" fill="var(--cf-accent)" opacity="0.5" rx="2" />
            <rect x="45" y="10" width="15" height="40" fill="var(--cf-accent)" opacity="0.7" rx="2" />
            <rect x="65" y="15" width="15" height="35" fill="var(--cf-accent)" opacity="0.6" rx="2" />
            <rect x="85" y="25" width="15" height="25" fill="var(--cf-accent)" opacity="0.4" rx="2" />
          </svg>
        </BlurredChart>
      </div>

      {/* CTA */}
      <div className="mt-5 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          See how you&apos;re really progressing {"\u2014"}{" "}
          <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>$7.99 CAD/mo</span>
        </p>
        <Link
          href="/pricing"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all"
          style={{
            background: "linear-gradient(135deg, var(--accent-violet), var(--accent-cyan))",
            border: "1px solid rgba(139,92,246,0.3)",
            boxShadow: "0 4px 12px rgba(139,92,246,0.2)",
          }}
        >
          Upgrade to Pro {"\u2192"}
        </Link>
      </div>
    </motion.section>
  );
}
