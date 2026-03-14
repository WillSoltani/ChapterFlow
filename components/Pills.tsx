"use client";

import { motion } from "framer-motion";

export function FormatPill(props: {
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={props.onClick}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        "border border-white/10",
        props.active
          ? "bg-sky-600/90 text-white shadow-[0_14px_40px_rgba(56,189,248,0.20)]"
          : "bg-white/5 text-slate-200 hover:bg-white/8",
      ].join(" ")}
    >
      {props.label}
    </motion.button>
  );
}

export function SoftButton(props: {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
        "border border-white/10 disabled:opacity-50",
        props.primary
          ? "bg-sky-600/90 text-white hover:bg-sky-500 shadow-[0_14px_40px_rgba(56,189,248,0.18)]"
          : props.danger
            ? "bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
            : "bg-white/5 text-slate-200 hover:bg-white/10",
      ].join(" ")}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
