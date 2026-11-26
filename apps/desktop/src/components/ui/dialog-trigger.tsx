import type { ComponentProps, FC } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

export type DialogTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>

export const DialogTrigger: FC<DialogTriggerProps> = (props) => (
  <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
)
