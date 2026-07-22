import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { Button as CanonicalButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

type CanonicalVariant = NonNullable<ComponentProps<typeof CanonicalButton>["variant"]>;
type CanonicalSize = NonNullable<ComponentProps<typeof CanonicalButton>["size"]>;

const variantMap: Record<ButtonVariant, CanonicalVariant> = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
  success: "success",
};

const sizeMap: Record<ButtonSize, CanonicalSize> = {
  sm: "sm",
  md: "default",
  lg: "lg",
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
    <CanonicalButton
      type={type}
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={cn(fullWidth && "w-full", className)}
      {...props}
    />
  );
}
