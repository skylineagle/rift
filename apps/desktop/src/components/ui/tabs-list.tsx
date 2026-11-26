import type { ComponentProps, FC } from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>

export const TabsList: FC<TabsListProps> = ({ className, ...props }) => (
  <TabsPrimitive.List
    data-slot="tabs-list"
    className={cn(
      "grid auto-cols-fr grid-flow-col rounded-lg border border-line-2 bg-surface-2 p-0.5",
      className
    )}
    {...props}
  />
)
