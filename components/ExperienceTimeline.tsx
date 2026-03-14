"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";

type ExperienceItem = {
  title: string;
  org: string;
  location?: string;
  dates?: string;
  bullets: string[];
};

type Props = {
  items: ExperienceItem[];
};

export function ExperienceTimeline({ items }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative">
      {/* Timeline rail: use top/bottom instead of h-full for reliability */}
      <div
        className="
          pointer-events-none absolute
          left-[14px] sm:left-[18px]
          top-0 bottom-0
          w-[2px]
          bg-gradient-to-b from-sky-400/30 via-violet-400/20 to-transparent
        "
      />

      <div className="space-y-5 sm:space-y-6">
        {items.map((item) => (
          <div
            key={`${item.org}-${item.title}-${item.dates ?? ""}`}
            className="relative pl-11 sm:pl-14"
          >
            {/* Dot + pulse */}
            <div className="absolute left-[8px] sm:left-[12px] top-5 sm:top-6">
              <span className="relative flex h-3.5 w-3.5 sm:h-4 sm:w-4">
                {!reduceMotion ? (
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full bg-sky-400/30"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.55, 0.12, 0.55] }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ) : null}
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.35)] sm:h-4 sm:w-4" />
              </span>
            </div>

            {/* Card */}
            <motion.div
              // Keep hover motion subtle and safe. If user prefers reduced motion, disable it.
              whileHover={!reduceMotion ? { x: 6 } : undefined}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
            >
              <Card className="group relative overflow-hidden border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-6 sm:backdrop-blur">
                {/* hover tint */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(700px_circle_at_20%_10%,rgba(56,189,248,0.10),transparent_60%)]" />

                <div className="relative">
                  {/* Header: stack on mobile, split on larger */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {item.org}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>

                    {item.dates ? (
                      <span className="w-fit whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {item.dates}
                      </span>
                    ) : null}
                  </div>

                  {/* Bullets: slightly tighter on mobile */}
                  {item.bullets?.length ? (
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {item.bullets.map((b) => (
                        <li key={b} className="leading-relaxed">
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
