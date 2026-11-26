import type { ComponentProps, FC } from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger>

export const TabsTrigger: FC<TabsTriggerProps> = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    data-slot="tabs-trigger"
    className={cn(
      "flex h-6 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-fg-3 transition-colors duration-150 hover:text-fg data-[state=active]:bg-surface-4 data-[state=active]:text-fg data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_0_0_1px_var(--line-2)]",
      className
    )}
    {...props}
  />
)
