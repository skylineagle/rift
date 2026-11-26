import { Play, Square } from "lucide-react";
import type { FC } from "react";

import { Hint } from "@/components/Hint";
import { TooltipButton } from "@/components/TooltipButton";
import { Button } from "@/components/ui/button";
import { useIsRunning } from "@/hooks/useBridge";
import { startWorkflow, stopWorkflow } from "@/stores/workflowRunStore";

export type WorkflowRunButtonProps = {
  profileName: string;
  workflowName: string;
  active: boolean;
};

export const WorkflowRunButton: FC<WorkflowRunButtonProps> = ({
  profileName,
  workflowName,
  active,
}) => {
  const bridgeRunning = useIsRunning(profileName);

  if (active) {
    return (
      <TooltipButton
        variant="ghost"
        size="icon"
        tip={`Stop ${workflowName}`}
        className="text-accent-text hover:text-accent-text"
        onClick={() => void stopWorkflow(profileName, workflowName)}
      >
        <Square className="size-3! fill-current" />
      </TooltipButton>
    );
  }
  if (!bridgeRunning) {
    return (
      <Hint text="Start the bridge first">
        <span tabIndex={0} className="flex rounded-[7px]">
          <Button variant="ghost" size="icon" aria-label={`Run ${workflowName}`} disabled>
            <Play />
          </Button>
        </span>
      </Hint>
    );
  }
  return (
    <TooltipButton
      variant="ghost"
      size="icon"
      tip={`Run ${workflowName}`}
      onClick={() => void startWorkflow(profileName, workflowName)}
    >
      <Play />
    </TooltipButton>
  );
};
