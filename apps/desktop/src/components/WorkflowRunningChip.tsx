import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/useStore";
import { openWorkflowPanel, workflowPanelStore } from "@/stores/workflowPanelStore";
import { selectRunning, workflowRunStore } from "@/stores/workflowRunStore";

export type WorkflowRunningChipProps = { profileName: string };

export const WorkflowRunningChip: FC<WorkflowRunningChipProps> = ({ profileName }) => {
  const count = useStore(workflowRunStore, (state) => selectRunning(state, profileName).length);
  const open = useStore(workflowPanelStore, (state) => state.open);
  if (open || count === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="bg-accent-soft font-mono text-[11px] text-accent-text hover:bg-accent-soft hover:text-accent-text"
      onClick={openWorkflowPanel}
    >
      <span aria-hidden="true" className="size-1.5 animate-pulse-dot rounded-full bg-amber" />
      {count} running
    </Button>
  );
};
