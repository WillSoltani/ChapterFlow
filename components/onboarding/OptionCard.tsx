"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface OptionCardProps {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function OptionCard({
  id,
  icon,
  title,
  description,
  selected,
  onSelect,
}: OptionCardProps) {
  return (
    <motion.button
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      className="relative w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        padding: 20,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: "var(--radius-lg-val)",
        border: selected
          ? "1px solid rgba(52,211,153,0.3)"
          : "1px solid var(--border-subtle)",
        background: selected
          ? "rgba(52,211,153,0.04)"
          : "var(--bg-glass)",
        boxShadow: selected ? "0 0 20px rgba(52,211,153,0.06)" : "none",
        outlineColor: "var(--accent-blue)",
      }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      whileHover={
        selected
          ? undefined
          : {
              y: -2,
              borderColor: "var(--cf-border-strong)",
              backgroundColor: "var(--cf-surface-muted)",
            }
      }
    >
      {/* Icon container */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm-val)",
          background: "rgba(79,139,255,0.08)",
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <p
        className="mt-3"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-heading)",
        }}
      >
        {title}
      </p>

      {/* Description */}
      <p
        className="mt-1 line-clamp-2"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>

      {/* Selection circle */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: 16,
          right: 16,
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: selected ? "none" : "2px solid var(--border-medium)",
          background: selected ? "var(--accent-green)" : "transparent",
          transition: "all 0.2s ease-out",
        }}
      >
        {selected && (
          <motion.svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <path
              d="M2 5L4.5 7.5L8 3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </div>
    </motion.button>
  );
}
