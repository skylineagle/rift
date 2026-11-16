import type { ComponentProps, FC } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type TooltipButtonProps = ComponentProps<typeof Button> & {
  tip: string;
};

export const TooltipButton: FC<TooltipButtonProps> = ({ tip, ...buttonProps }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button aria-label={tip} {...buttonProps} />
    </TooltipTrigger>
    <TooltipContent>{tip}</TooltipContent>
  </Tooltip>
);
