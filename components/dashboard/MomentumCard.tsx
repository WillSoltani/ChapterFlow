"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const ease = [0.22, 1, 0.36, 1] as const;

export function MomentumCard() {
  return (
    <motion.div
      className="mt-[22px]"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: 0.1, ease }}
    >
      <GlassCard className="flex items-center gap-4 p-5">
        {/* Badge icon */}
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-xl"
          style={{
            width: 48,
            height: 48,
            background: "rgba(232,185,49,0.08)",
            border: "1px solid rgba(232,185,49,0.15)",
            boxShadow: "0 0 12px var(--accent-gold-glow)",
          }}
        >
          <Trophy size={24} style={{ color: "var(--accent-gold)" }} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Next milestone:{" "}
            <span
              className="font-semibold"
              style={{ color: "var(--accent-gold)" }}
            >
              Focus Master
            </span>
          </p>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: "var(--text-muted)" }}
          >
            Complete 2 more chapters of Deep Work
          </p>
          {/* Progress bar */}
          <div
            className="mt-2.5 h-[5px] overflow-hidden rounded-[3px]"
            style={{ background: "var(--bg-elevated)" }}
          >
            <motion.div
              className="h-full rounded-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, var(--accent-gold), var(--accent-flame))",
              }}
              initial={{ width: "0%" }}
              whileInView={{ width: "60%" }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Counter */}
        <span
          className="flex-shrink-0 font-(family-name:--font-jetbrains) text-[14px]"
          style={{ color: "var(--text-muted)" }}
        >
          3 / 5
        </span>
      </GlassCard>
    </motion.div>
  );
}
