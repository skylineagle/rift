import type { ComponentProps, FC } from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

export type TabsContentProps = ComponentProps<typeof TabsPrimitive.Content>

export const TabsContent: FC<TabsContentProps> = (props) => (
  <TabsPrimitive.Content data-slot="tabs-content" {...props} />
)
