import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "cf-btn inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default: "cf-btn-primary",
        destructive: "cf-btn-danger",
        outline: "cf-btn-secondary shadow-xs",
        secondary: "cf-btn-secondary",
        ghost: "cf-btn-ghost",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--cf-control-height-md)] px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-xl px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[var(--cf-control-height-sm)] gap-1.5 rounded-xl px-3 has-[>svg]:px-2.5",
        lg: "h-[var(--cf-control-height-lg)] rounded-2xl px-6 has-[>svg]:px-4",
        icon: "size-[var(--cf-control-height-md)] rounded-2xl",
        "icon-xs": "size-7 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-[var(--cf-control-height-sm)] rounded-xl",
        "icon-lg": "size-[var(--cf-control-height-lg)] rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
