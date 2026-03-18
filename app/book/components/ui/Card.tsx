"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/book/components/ui/cn";

type CardVariant = "default" | "accent" | "interactive" | "danger";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  children: ReactNode;
};

const variantClass: Record<CardVariant, string> = {
  default: "cf-panel",
  accent: "cf-panel border-(--cf-accent-border) bg-(--cf-accent-soft)",
  interactive: "cf-panel cf-panel-hover",
  danger: "cf-panel border-(--cf-danger-border) bg-(--cf-danger-soft)",
};

export function Card({ variant = "default", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl p-5",
        variantClass[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
