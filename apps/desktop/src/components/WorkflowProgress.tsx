import type { FC } from "react";

import type { Workflow } from "@/lib/types";
import type { WorkflowProgress as RunProgress } from "@/lib/workflowRuns";
import { progressFraction, progressLabel } from "@/lib/workflows";

export type WorkflowProgressProps = { workflow: Workflow; progress: RunProgress };

export const WorkflowProgress: FC<WorkflowProgressProps> = ({ workflow, progress }) => (
  <div className="flex items-center gap-2 px-2 pb-2">
    <div aria-hidden="true" className="h-0.5 flex-1 overflow-hidden rounded-full bg-surface-4">
      <div
        className="h-full origin-left rounded-full bg-amber transition-transform duration-200 ease-out"
        style={{ transform: `scaleX(${progressFraction(progress, workflow)})` }}
      />
    </div>
    <span className="font-mono text-[10.5px] whitespace-nowrap text-accent-text tabular-nums">
      {progressLabel(progress, workflow.repeat)}
    </span>
  </div>
);
