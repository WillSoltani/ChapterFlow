"use client";

import { motion } from "framer-motion";

export function ActiveDaysRing({ active, total }: { active: number; total: number }) {
  const pct = Math.min(100, Math.round((active / Math.max(total, 1)) * 100));
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 100 ? "var(--accent-gold)" : pct >= 50 ? "var(--cf-success-text)" : "var(--cf-accent)";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`${active} of ${total} active days`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--cf-border)" strokeWidth="5" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fill="currentColor" className="text-(--cf-text-1)" fontSize="18" fontWeight="700">
          {active}
        </text>
      </svg>
      <p className="text-xs text-(--cf-text-3)">of {total} days</p>
    </div>
  );
}
