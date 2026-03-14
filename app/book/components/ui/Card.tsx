"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/book/components/ui/cn";

type CardVariant = "default" | "accent" | "interactive" | "danger";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  children: ReactNode;
};

const variantClass: Record<CardVariant, string> = {
  default:
    "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]",
  accent:
    "border-sky-300/25 bg-[linear-gradient(145deg,rgba(14,116,144,0.22),rgba(15,23,42,0.8))]",
  interactive:
    "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] transition hover:-translate-y-0.5 hover:border-sky-300/30 hover:shadow-[0_16px_34px_rgba(2,6,23,0.48)]",
  danger:
    "border-rose-400/30 bg-rose-500/8",
};

export function Card({ variant = "default", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-5 shadow-[0_16px_40px_rgba(2,6,23,0.45)]",
        variantClass[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
