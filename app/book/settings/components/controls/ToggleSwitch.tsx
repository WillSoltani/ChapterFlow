"use client";

import { motion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent)/40 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)",
        "disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "bg-(--cf-accent) shadow-[inset_0_0_6px_var(--cf-accent-shadow)]"
          : "bg-(--cf-surface-strong)"
      )}
    >
      <motion.div
        className={cn(
          "absolute top-1 w-4 h-4 rounded-full pointer-events-none",
          checked
            ? "bg-white shadow-[0_0_4px_rgba(34,211,238,0.3)]"
            : "bg-(--cf-text-soft) shadow-sm"
        )}
        animate={{ left: checked ? 22 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
