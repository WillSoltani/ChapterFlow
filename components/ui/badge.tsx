import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
    "transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-[var(--cf-accent-soft)] focus:ring-offset-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] text-[var(--cf-accent)]",
        secondary:
          "border-[var(--cf-border)] bg-[var(--cf-surface-muted)] text-[var(--cf-text-2)]",
        destructive:
          "border-[var(--cf-danger-border)] bg-[var(--cf-danger-soft)] text-[var(--cf-danger-text)]",
        outline:
          "border-[var(--cf-border)] bg-transparent text-[var(--cf-text-2)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
