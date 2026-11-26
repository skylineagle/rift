import { LayoutDashboard } from "lucide-react";
import type { FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import { useStore } from "@/hooks/useStore";
import { isReordering, layoutStore, toggleReorder } from "@/stores/layoutStore";

export const ReorderToggleButton: FC = () => {
  const reordering = useStore(layoutStore, isReordering);

  return (
    <TooltipButton
      variant="ghost"
      size="icon"
      tip="Reorder panels (hold ⌥ / Alt)"
      aria-pressed={reordering}
      onClick={toggleReorder}
      className="aria-pressed:bg-accent-soft aria-pressed:text-accent-text"
    >
      <LayoutDashboard />
    </TooltipButton>
  );
};
