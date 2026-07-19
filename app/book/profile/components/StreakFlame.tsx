"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MILESTONE_STREAKS = new Set([7, 14, 21, 30, 50, 100, 200, 365]);

export function StreakFlame({ active, size = 28, streakDays = 0 }: { active: boolean; size?: number; streakDays?: number }) {
  const celebratedRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [particles] = useState(() => {
    const colors = ["var(--cf-profile-flame-base)", "var(--cf-profile-flame-mid)", "var(--cf-profile-flame-light)", "var(--cf-profile-flame-pale)"];
    return Array.from({ length: 7 }).map((_, i) => {
      const angle = (i / 7) * 360 + Math.random() * 30;
      const dist = 30 + Math.random() * 25;
      const rad = (angle * Math.PI) / 180;
      return {
        x: Math.cos(rad) * dist,
        y: Math.sin(rad) * dist,
        color: colors[i % colors.length],
      };
    });
  });
  const isMilestone = MILESTONE_STREAKS.has(streakDays);

  useEffect(() => {
    if (isMilestone && active && !celebratedRef.current) {
      celebratedRef.current = true;
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [isMilestone, active]);

  return (
    <span className="relative inline-flex shrink-0">
      {/* Ambient glow wrapper */}
      <span
        className={cn("inline-flex shrink-0", active && "cf-flame-flicker")}
        style={active ? { filter: "drop-shadow(0 0 12px var(--accent-amber)) drop-shadow(0 0 24px color-mix(in srgb, var(--accent-amber) 15%, transparent))" } : undefined}
      >
        <svg
          width={size}
          height={Math.round(size * 32 / 28)}
          viewBox="0 0 28 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M14 1C14 1 5 10.5 5 17C5 22.52 9.03 27 14 27C18.97 27 23 22.52 23 17C23 10.5 14 1 14 1Z"
            fill={active ? "url(#flameGradV2)" : "var(--cf-text-soft)"}
            opacity={active ? 1 : 0.6}
          />
          <path
            d="M14 27C11.79 27 10 24.88 10 22.1C10 19.32 14 14 14 14C14 14 18 19.32 18 22.1C18 24.88 16.21 27 14 27Z"
            fill={active ? "var(--cf-profile-flame-pale)" : "var(--cf-text-soft)"}
            opacity={active ? 0.9 : 0.3}
          />
          <defs>
            <linearGradient id="flameGradV2" x1="14" y1="1" x2="14" y2="27" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--accent-amber)" />
              <stop offset="1" stopColor="var(--cf-profile-flame-dark)" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      {/* Milestone celebration particles */}
      {showCelebration ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {particles.map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full"
              style={{ backgroundColor: p.color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: p.x,
                y: p.y,
                opacity: 0,
                scale: 0.5,
              }}
              transition={{ duration: DUR.reveal, ease: "easeOut" }}
            />
          ))}
        </span>
      ) : null}

      <style>{`
        @keyframes cf-flame-flicker {
          0%, 100% { transform: translateY(0) scaleY(1); filter: brightness(1); }
          25% { transform: translateY(-1px) scaleY(1.04); filter: brightness(1.08); }
          50% { transform: translateY(0.5px) scaleY(0.97); filter: brightness(0.95); }
          75% { transform: translateY(-0.5px) scaleY(1.02); filter: brightness(1.05); }
        }
        .cf-flame-flicker {
          animation: cf-flame-flicker 2.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-flame-flicker { animation: none; }
        }
      `}</style>
    </span>
  );
}
