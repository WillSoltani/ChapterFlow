"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/app/book/components/ui/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-sky-300/35 bg-linear-to-r from-sky-500 to-cyan-400 text-white shadow-[0_12px_24px_rgba(14,165,233,0.3)] hover:brightness-105",
  secondary:
    "border border-white/22 bg-white/6 text-slate-100 hover:bg-white/11",
  ghost:
    "border border-transparent bg-transparent text-slate-200 hover:bg-white/8",
  danger:
    "border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/24",
  success:
    "border border-emerald-300/40 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/26",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 rounded-xl px-3 text-sm",
  md: "h-10 rounded-xl px-4 text-sm",
  lg: "h-12 rounded-2xl px-5 text-base",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 disabled:cursor-not-allowed disabled:opacity-45",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
}
