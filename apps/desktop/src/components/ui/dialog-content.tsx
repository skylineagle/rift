import type { ComponentProps, FC } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content>

export const DialogContent: FC<DialogContentProps> = ({ className, children, ...props }) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[3px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      data-slot="dialog-content"
      className={cn(
        "fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100vh-32px)] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line-2 bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.45)] outline-hidden duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-97 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-97",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
)
