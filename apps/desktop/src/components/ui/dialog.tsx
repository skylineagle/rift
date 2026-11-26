import type { ComponentProps, FC } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

export type DialogProps = ComponentProps<typeof DialogPrimitive.Root>

export const Dialog: FC<DialogProps> = (props) => (
  <DialogPrimitive.Root data-slot="dialog" {...props} />
)
