"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  eyebrow,
  icon,
  right,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <div
      className={cn("cf-panel rounded-3xl p-5", "overflow-hidden p-0", className)}
      {...props}
    >
      <div className="border-b border-(--cf-divider) bg-(--cf-surface-muted) px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon ? (
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)">
                {icon}
              </div>
            ) : null}
            <div>
              {eyebrow ? (
                <p className="text-cf-caption uppercase tracking-[0.26em] text-(--cf-text-3)">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                {title}
              </h2>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-(--cf-text-2)">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </div>
  );
}
