import type { ComponentProps, FC } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

export type DialogDescriptionProps = ComponentProps<typeof DialogPrimitive.Description>

export const DialogDescription: FC<DialogDescriptionProps> = ({ className, ...props }) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    className={cn(
      "text-xs text-fg-3",
      className
    )}
    {...props}
  />
)
