import * as React from "react"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "grid auto-cols-fr grid-flow-col rounded-lg border border-line-2 bg-surface-2 p-0.5",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "flex h-6 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-fg-3 transition-colors duration-150 hover:text-fg data-[state=active]:bg-surface-4 data-[state=active]:text-fg data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_0_0_1px_var(--line-2)]",
        className
      )}
      {...props}
    />
  )
}

function TabsContent(props: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
