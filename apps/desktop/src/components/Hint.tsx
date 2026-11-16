import type { FC, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type HintProps = {
  text: string;
  children: ReactNode;
};

export const Hint: FC<HintProps> = ({ text, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>
);
