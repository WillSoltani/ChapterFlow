"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";

/* ------------------------------------------------------------------ */
/*  Forgetting-curve SVG paths                                        */
/* ------------------------------------------------------------------ */

// Red line — exponential decay: starts at ~100% retention (y=20), drops steeply to ~20% (y=240)
const redPath =
  "M 0,20 C 60,40 100,120 160,170 C 220,210 300,230 400,236 C 480,239 540,240 580,240";

// Teal line — active recall with small dips at review intervals then recovery
// Starts at 100% (y=20), ends at ~85% (y=60)
// Dips near Day 1 (~x=80), Day 3 (~x=230), Day 7 (~x=430)
const tealPath =
  "M 0,20 C 20,20 40,22 70,42 C 85,28 100,24 130,26 C 160,28 195,48 220,55 C 240,38 260,34 300,36 C 340,38 395,52 420,58 C 445,44 465,42 520,48 C 550,50 570,55 580,60";

/* Grid y-positions for 100%, 75%, 50%, 25%, 0% */
const gridLines = [
  { y: 20, label: "100%" },
  { y: 75, label: "75%" },
  { y: 130, label: "50%" },
  { y: 185, label: "25%" },
  { y: 240, label: "0%" },
];

/* X-axis tick positions (inside the chart area, before the g translate) */
const xLabels = [
  { x: 80, label: "Day 1" },
  { x: 230, label: "Day 3" },
  { x: 430, label: "Day 7" },
];

/* ------------------------------------------------------------------ */
/*  Animated path component                                           */
/* ------------------------------------------------------------------ */

function AnimatedPath({
  d,
  color,
  isInView,
  skipAnimation,
  delay = 0,
}: {
  d: string;
  color: string;
  isInView: boolean;
  skipAnimation: boolean;
  delay?: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  if (skipAnimation) {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    );
  }

  return (
    <motion.path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.8}
      strokeDasharray={length || 2000}
      initial={{ strokeDashoffset: length || 2000 }}
      animate={
        isInView
          ? { strokeDashoffset: 0 }
          : { strokeDashoffset: length || 2000 }
      }
      transition={{
        duration: 2,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Problem section                                                   */
/* ------------------------------------------------------------------ */

export function Problem() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInView = useInView(chartRef, { once: true, amount: 0.3 });
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="problem" className="py-14 lg:py-20">
      <div className="mx-auto max-w-[720px] px-5">
        {/* Label */}
        <SectionReveal>
          <SectionLabel>THE PROBLEM</SectionLabel>
        </SectionReveal>

        {/* Headline */}
        <SectionReveal delay={0.1}>
          <h2
            className="mt-4 text-[28px] md:text-[36px] lg:text-[44px] font-bold leading-[1.1] tracking-[-0.02em] font-(family-name:--font-display)"
            style={{ color: "var(--text-heading)" }}
          >
            You read books but forget most of it within days.
          </h2>
        </SectionReveal>

        {/* Body */}
        <SectionReveal delay={0.2}>
          <p
            className="mt-6 text-[16px] md:text-[18px] leading-[1.7] font-(family-name:--font-body)"
            style={{ color: "var(--text-secondary)" }}
          >
            You highlight. You take notes. You tell yourself you&apos;ll come
            back to it. A month later, you can barely name the chapters — let
            alone use the ideas that were supposed to change how you think.
          </p>
        </SectionReveal>

        {/* Forgetting Curve Chart */}
        <SectionReveal delay={0.35}>
          <div
            ref={chartRef}
            className="mt-10 rounded-xl p-6 md:p-8"
            style={{
              background: "var(--bg-glass)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* SVG Chart */}
            <svg
              viewBox="0 0 600 300"
              className="w-full"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Forgetting curve chart comparing retention with and without active recall"
              role="img"
            >
              {/* Subtle horizontal grid lines */}
              {gridLines.map((line) => (
                <line
                  key={line.label}
                  x1={45}
                  y1={line.y}
                  x2={590}
                  y2={line.y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                  strokeDasharray="6 4"
                />
              ))}

              {/* Y-axis labels */}
              {gridLines.map((line) => (
                <text
                  key={`y-${line.label}`}
                  x={40}
                  y={line.y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize={11}
                  fontFamily="var(--font-body)"
                >
                  {line.label}
                </text>
              ))}

              {/* X-axis labels */}
              {xLabels.map((item) => (
                <text
                  key={item.label}
                  x={item.x}
                  y={270}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize={11}
                  fontFamily="var(--font-body)"
                >
                  {item.label}
                </text>
              ))}

              {/* Animated curve paths */}
              <AnimatedPath
                d={redPath}
                color="#ef4444"
                isInView={chartInView}
                skipAnimation={!!prefersReducedMotion}
                delay={0.3}
              />

              <AnimatedPath
                d={tealPath}
                color="#2dd4bf"
                isInView={chartInView}
                skipAnimation={!!prefersReducedMotion}
                delay={0.6}
              />
            </svg>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#ef4444" }}
                />
                <span
                  className="text-[13px] font-(family-name:--font-body)"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Without active recall
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#2dd4bf" }}
                />
                <span
                  className="text-[13px] font-(family-name:--font-body)"
                  style={{ color: "var(--text-secondary)" }}
                >
                  With ChapterFlow
                </span>
              </div>
            </div>

            {/* Attribution */}
            <p
              className="mt-3 text-center text-[12px] italic font-(family-name:--font-body)"
              style={{ color: "var(--text-muted)" }}
            >
              Based on Ebbinghaus&apos;s Forgetting Curve — active recall is the
              only proven method to beat it.
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
