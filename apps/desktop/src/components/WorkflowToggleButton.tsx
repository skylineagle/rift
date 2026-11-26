import { ListVideo } from "lucide-react";
import type { FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import { useStore } from "@/hooks/useStore";
import { toggleWorkflowPanel, workflowPanelStore } from "@/stores/workflowPanelStore";

export const WorkflowToggleButton: FC = () => {
  const open = useStore(workflowPanelStore, (state) => state.open);

  return (
    <TooltipButton
      variant="ghost"
      size="icon"
      tip="Workflows"
      aria-expanded={open}
      onClick={toggleWorkflowPanel}
    >
      <ListVideo />
    </TooltipButton>
  );
};
