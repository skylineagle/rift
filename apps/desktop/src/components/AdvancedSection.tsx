import { ChevronRight } from "lucide-react";
import type { FC, ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type AdvancedSectionProps = { children: ReactNode };

export const AdvancedSection: FC<AdvancedSectionProps> = ({ children }) => (
  <Collapsible className="col-span-full grid gap-y-[9px]">
    <CollapsibleTrigger className="group inline-flex items-center gap-[5px] justify-self-start bg-transparent py-0.5 text-[11.5px] font-medium text-fg-3 transition-colors hover:text-fg">
      <ChevronRight className="size-3 transition-transform duration-150 ease-out group-data-[state=open]:rotate-90 motion-reduce:transition-none" />
      Advanced
    </CollapsibleTrigger>
    <CollapsibleContent className="grid grid-cols-2 gap-x-2.5 gap-y-[9px]">
      {children}
    </CollapsibleContent>
  </Collapsible>
);
