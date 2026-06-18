"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ProgressRing } from "../ui/ProgressRing";

interface DailyGoalRingProps {
  completedMinutes: number;
  targetMinutes: number;
  stepsCompleted: number;
  totalSteps: number;
  /** Whether user browsed a book today but hasn't started reading */
  hasEndowedProgress?: boolean;
}

// Color constants — theme-aware tokens (resolve correctly as SVG stroke / inline
// style / CSS filter values in both light and dark).
const CYAN = "var(--accent-cyan)";
const CYAN_TRACK = "var(--cf-progress-track)";
const PURPLE = "var(--accent-violet)";
const PURPLE_TRACK = "var(--accent-violet-glow)";

export function DailyGoalRing({
  completedMinutes,
  targetMinutes,
  stepsCompleted,
  totalSteps,
  hasEndowedProgress = false,
}: DailyGoalRingProps) {
  const prefersReduced = useReducedMotion();

  const outerPercent = targetMinutes > 0
    ? Math.min(100, (completedMinutes / targetMinutes) * 100)
    : 0;
  const innerPercent = totalSteps > 0
    ? Math.min(100, (stepsCompleted / totalSteps) * 100)
    : 0;

  // Endowed progress: show 5% if user browsed but hasn't read
  const effectiveOuterPercent =
    outerPercent === 0 && hasEndowedProgress ? 5 : outerPercent;

  const isGoalComplete = effectiveOuterPercent >= 100;
  const remaining = Math.max(0, targetMinutes - completedMinutes);

  // SVG dimensions — responsive
  const desktopSize = 220;
  const mobileSize = 180;
  const outerStroke = 11;
  const innerStroke = 9;
  const gap = 16;

  function renderRing(
    size: number,
    containerClass: string
  ) {
    // The inner ring sits at radius (outerRadius - gap). ProgressRing derives
    // its radius from `size` as (size - stroke)/2, so to place the inner arc at
    // the original radius we give it a smaller size:
    //   (innerSize - innerStroke)/2 === (size - outerStroke)/2 - gap
    //   => innerSize === size - outerStroke - 2*gap + innerStroke
    const innerSize = size - outerStroke - 2 * gap + innerStroke;

    return (
      <div
        className={`relative items-center justify-center ${containerClass}`}
        style={{ width: size, height: size }}
        role="progressbar"
        aria-valuenow={Math.round(effectiveOuterPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Daily goal: ${completedMinutes} of ${targetMinutes} minutes completed. ${stepsCompleted} of ${totalSteps} learning steps done today.`}
      >
        {/* Outer arc — reading minutes. Keep the bespoke 8px completion glow on
            a wrapping element (ProgressRing's built-in glow is 6px) for exact
            visual parity. */}
        <div
          className="absolute inset-0 inline-flex items-center justify-center"
          style={{
            filter: isGoalComplete
              ? `drop-shadow(0 0 8px ${CYAN})`
              : undefined,
          }}
        >
          <ProgressRing
            percent={effectiveOuterPercent}
            size={size}
            strokeWidth={outerStroke}
            color={CYAN}
            trackColor={CYAN_TRACK}
            showLabel={false}
            showCompletionGlow={false}
            delay={150}
            decorative
          />
        </div>

        {/* Inner arc — learning steps. Smaller diameter, centered over the
            outer ring. No completion glow. */}
        <div className="absolute inset-0 inline-flex items-center justify-center">
          <ProgressRing
            percent={innerPercent}
            size={innerSize}
            strokeWidth={innerStroke}
            color={PURPLE}
            trackColor={PURPLE_TRACK}
            showLabel={false}
            showCompletionGlow={false}
            delay={350}
            decorative
          />
        </div>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isGoalComplete ? (
            <motion.span
              className="font-(family-name:--font-display) text-2xl font-bold text-accent-emerald"
              initial={{ scale: prefersReduced ? 1 : 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.2, type: "spring", stiffness: 300 }}
            >
              {"✓"} Done!
            </motion.span>
          ) : completedMinutes === 0 ? (
            <span
              className="font-(family-name:--font-display) text-2xl font-bold"
              style={{ color: "var(--text-heading)" }}
            >
              0m
            </span>
          ) : (
            <span
              className="font-(family-name:--font-display) text-2xl font-bold"
              style={{ color: "var(--text-heading)" }}
            >
              {remaining}m
            </span>
          )}
          <span
            className="mt-0.5 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {isGoalComplete
              ? `${targetMinutes} min goal reached`
              : `of ${targetMinutes} min goal`}
          </span>
        </div>

        {/* Completion glow animation */}
        {isGoalComplete && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full"
            // Static theme-aware glow; the opacity pulse below fades it in/out.
            // (framer-motion can't interpolate between var() box-shadow keyframes,
            // so we animate opacity instead of the shadow color.)
            style={{ boxShadow: "0 0 24px var(--accent-emerald-glow)" }}
            initial={{ opacity: 0, scale: 1 }}
            animate={{
              opacity: [0, 0.6, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 1.5,
              delay: 1.2,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Desktop ring */}
      {renderRing(desktopSize, "hidden lg:inline-flex")}
      {/* Mobile ring */}
      {renderRing(mobileSize, "inline-flex lg:hidden")}

      {/* Ring legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: CYAN }}
          />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Reading time
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: PURPLE }}
          />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Steps today
          </span>
        </div>
      </div>
    </div>
  );
}
