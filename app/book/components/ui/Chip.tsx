"use client";

import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/app/book/components/ui/cn";

type ChipTone = "neutral" | "sky" | "emerald" | "amber" | "rose";

const toneClass: Record<ChipTone, string> = {
  neutral: "border-white/25 bg-white/6 text-slate-200",
  sky: "border-sky-300/35 bg-sky-500/14 text-sky-100",
  emerald: "border-emerald-300/35 bg-emerald-500/14 text-emerald-100",
  amber: "border-amber-300/35 bg-amber-500/14 text-amber-100",
  rose: "border-rose-300/35 bg-rose-500/14 text-rose-100",
};

type BaseProps = {
  tone?: ChipTone;
  active?: boolean;
  className?: string;
};

export function Chip({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & BaseProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}

export function ChipButton({
  tone = "neutral",
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
        toneClass[tone],
        active && "shadow-[0_0_0_1px_rgba(56,189,248,0.25)]",
        !active && "opacity-85 hover:opacity-100",
        className
      )}
      {...props}
    />
  );
}
