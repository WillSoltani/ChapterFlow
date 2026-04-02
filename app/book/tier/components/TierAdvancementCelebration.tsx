"use client";

// Implements §3.4 — Tier advancement celebration modal.
// Prism icon morphs with glassmorphic shimmer. Shows accomplishment summary,
// identity statement, and IP award. Learning accomplishment first, IP second.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type TierAdvancementData = {
  tierName: string;
  displayName: string;
  identityStatement: string;
  advancementIP: number;
  loopsCompleted: number;
  avgScore: number;
  categoriesExplored: number;
};

type TierAdvancementCelebrationProps = {
  data: TierAdvancementData | null;
  onDismiss: () => void;
};

// Geometric prism SVG per §8.1 — scales with tier
function TierPrism({ tier, size = 80 }: { tier: string; size?: number }) {
  const isTop = tier === "polymath" || tier === "luminary";
  const isLuminary = tier === "luminary";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Halo for luminary */}
      {isLuminary && (
        <circle
          cx="40"
          cy="40"
          r="38"
          stroke="var(--accent-violet)"
          strokeWidth={1}
          opacity={0.3}
        />
      )}
      {/* Glow for polymath+ */}
      {isTop && (
        <circle
          cx="40"
          cy="40"
          r="30"
          fill="var(--accent-violet)"
          fillOpacity={0.08}
        />
      )}
      {/* Main prism */}
      <path
        d="M40 8L14 32l26 40 26-40L40 8z"
        fill="var(--accent-violet)"
        fillOpacity={0.15}
        stroke="var(--accent-violet)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Horizontal refraction line */}
      <path
        d="M14 32h52"
        stroke="var(--accent-violet)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Internal facets */}
      <path
        d="M40 8l-10 24M40 8l10 24M40 72l-16-40M40 72l16-40"
        stroke="var(--accent-violet)"
        strokeWidth={0.75}
        opacity={0.4}
      />
      {/* Spectrum refraction for synthesizer+ */}
      {(tier === "synthesizer" || isTop) && (
        <>
          <line x1="52" y1="38" x2="64" y2="42" stroke="var(--accent-cyan)" strokeWidth={1} opacity={0.6} />
          <line x1="52" y1="40" x2="64" y2="44" stroke="var(--accent-emerald)" strokeWidth={1} opacity={0.5} />
          <line x1="52" y1="42" x2="64" y2="46" stroke="var(--accent-amber)" strokeWidth={1} opacity={0.4} />
        </>
      )}
    </svg>
  );
}

export function TierAdvancementCelebration({
  data,
  onDismiss,
}: TierAdvancementCelebrationProps) {
  const reduced = useReducedMotion();

  if (!data) return null;

  if (reduced) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-(--cf-overlay)" onClick={onDismiss} />
        <div className="relative z-10 flex flex-col items-center rounded-3xl border border-(--cf-border-strong) bg-(--cf-surface-muted) p-8 text-center shadow-shadow-elevated" style={{ maxWidth: 400 }}>
          <TierPrism tier={data.tierName} size={64} />
          <h2 className="mt-4 text-xl font-semibold text-(--cf-text-1)">
            You&apos;ve reached {data.displayName}
          </h2>
          <p className="mt-2 text-sm text-(--cf-text-2)">
            {data.loopsCompleted} learning loops · {data.avgScore}% average comprehension · {data.categoriesExplored} categories
          </p>
          <p className="mt-3 text-sm italic text-(--cf-text-soft)">{data.identityStatement}</p>
          <p className="mt-3 text-sm tabular-nums font-medium" style={{ color: "var(--accent-violet)" }}>
            +{data.advancementIP} Insight Points
          </p>
          <button type="button" onClick={onDismiss} className="mt-6 rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-6 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-(--cf-overlay)" onClick={onDismiss} />

        <motion.div
          className="relative z-10 flex flex-col items-center rounded-3xl border border-(--cf-border-strong) bg-(--cf-surface-muted) p-8 text-center shadow-shadow-elevated"
          style={{
            maxWidth: 420,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* Shimmer overlay */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background: "linear-gradient(135deg, transparent 30%, color-mix(in srgb, var(--accent-violet) 8%, transparent) 50%, transparent 70%)",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 1.5, delay: 0.3, ease: "easeInOut" }}
          />

          {/* Prism icon with morph animation — §3.4 */}
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 12, bounce: 0.5 }}
          >
            <TierPrism tier={data.tierName} size={80} />
          </motion.div>

          {/* "You've reached [Tier Name]" */}
          <motion.h2
            className="mt-5 text-2xl font-semibold text-(--cf-text-1)"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            You&apos;ve reached {data.displayName}
          </motion.h2>

          {/* Accomplishment summary — §3.4 */}
          <motion.p
            className="mt-3 text-sm leading-relaxed text-(--cf-text-2)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {data.loopsCompleted} learning loops completed · {data.avgScore}% average comprehension · {data.categoriesExplored} categories explored
          </motion.p>

          {/* Identity statement — §3.4 */}
          <motion.p
            className="mt-3 text-sm italic leading-relaxed text-(--cf-text-soft)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {data.identityStatement}
          </motion.p>

          {/* IP award — shown below, smaller, per copy framework §8.2 */}
          {data.advancementIP > 0 && (
            <motion.p
              className="mt-3 text-sm tabular-nums font-medium"
              style={{ color: "var(--accent-violet)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              +{data.advancementIP} Insight Points
            </motion.p>
          )}

          {/* Dismiss */}
          <motion.button
            type="button"
            onClick={onDismiss}
            className="mt-7 rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-6 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Continue
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
