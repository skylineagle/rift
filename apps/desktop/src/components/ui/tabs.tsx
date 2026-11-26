import type { ComponentProps, FC } from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

export type TabsProps = ComponentProps<typeof TabsPrimitive.Root>

export const Tabs: FC<TabsProps> = (props) => (
  <TabsPrimitive.Root data-slot="tabs" {...props} />
)
