import type { ComponentProps, FC } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

export type DialogCloseProps = ComponentProps<typeof DialogPrimitive.Close>

export const DialogClose: FC<DialogCloseProps> = (props) => (
  <DialogPrimitive.Close data-slot="dialog-close" {...props} />
)
