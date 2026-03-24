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
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "min-h-11 min-w-11",
        checked
          ? "bg-(--cf-accent) shadow-[inset_0_1px_2px_rgba(0,0,0,0.15),0_0_8px_rgba(79,139,255,0.25)]"
          : "bg-white/10"
      )}
    >
      <motion.span
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full",
          checked
            ? "bg-white shadow-[0_0_6px_rgba(79,139,255,0.4)]"
            : "bg-(--cf-text-soft) shadow-sm"
        )}
      />
    </button>
  );
}
