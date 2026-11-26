import type { ComponentProps, FC } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

export type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title>

export const DialogTitle: FC<DialogTitleProps> = ({ className, ...props }) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    className={cn(
      "text-sm font-semibold",
      className
    )}
    {...props}
  />
)
