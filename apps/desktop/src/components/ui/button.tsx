import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] border border-transparent text-[12.5px] font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out outline-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110",
        secondary:
          "border-line-2 bg-surface-3 text-fg hover:bg-surface-4",
        ghost:
          "text-fg-2 hover:bg-surface-3 hover:text-fg aria-expanded:bg-surface-3 aria-expanded:text-fg",
      },
      size: {
        default: "h-7 px-2.5",
        sm: "h-6 px-2 text-xs",
        icon: "size-7",
        "icon-lg": "size-[30px] rounded-lg",
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
  const Comp = asChild ? Slot.Root : "button"

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
