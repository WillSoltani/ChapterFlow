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
  primary: "cf-btn-primary",
  secondary: "cf-btn-secondary",
  ghost: "cf-btn-ghost",
  danger: "cf-btn-danger",
  success: "cf-btn-success",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-(--cf-control-height-sm) rounded-xl px-3 text-sm",
  md: "h-(--cf-control-height-md) rounded-2xl px-4 text-sm",
  lg: "h-(--cf-control-height-lg) rounded-2xl px-5 text-base",
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
        "cf-btn inline-flex items-center justify-center gap-2 font-medium",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
}
