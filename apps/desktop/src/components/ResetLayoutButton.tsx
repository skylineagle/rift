import { RotateCcw } from "lucide-react";
import type { FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import { useStore } from "@/hooks/useStore";
import { isReordering, layoutStore, restoreDefaultLayout } from "@/stores/layoutStore";

export const ResetLayoutButton: FC = () => {
  const reordering = useStore(layoutStore, isReordering);
  if (!reordering) return null;

  return (
    <TooltipButton
      variant="ghost"
      size="icon"
      tip="Reset layout"
      onClick={restoreDefaultLayout}
    >
      <RotateCcw />
    </TooltipButton>
  );
};
