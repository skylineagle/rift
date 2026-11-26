import type { FC } from "react";

import { WorkflowProgress } from "@/components/WorkflowProgress";
import { WorkflowRowMenu } from "@/components/WorkflowRowMenu";
import { WorkflowRunButton } from "@/components/WorkflowRunButton";
import { useStore } from "@/hooks/useStore";
import type { Workflow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { workflowSummary } from "@/lib/workflows";
import { openEditor } from "@/stores/workflowPanelStore";
import { selectProgress, workflowRunStore } from "@/stores/workflowRunStore";

export type WorkflowRowProps = { profileName: string; workflow: Workflow };

export const WorkflowRow: FC<WorkflowRowProps> = ({ profileName, workflow }) => {
  const progress = useStore(workflowRunStore, (state) =>
    selectProgress(state, profileName, workflow.name),
  );

  return (
    <li className={cn("group rounded-lg hover:bg-surface-3", progress && "bg-surface-3")}>
      <div className="flex items-center gap-0.5 pr-1">
        <button
          type="button"
          onClick={() => openEditor(profileName, workflow, workflow.name)}
          className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-transparent py-2 pl-2 text-left text-fg"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <b className="truncate text-[12.5px] font-medium">{workflow.name}</b>
            {workflow.autostart && (
              <span className="flex-none rounded-[4px] bg-surface-4 px-1 py-0.5 text-[9px] leading-none font-bold tracking-[0.06em] text-fg-2">
                AUTO
              </span>
            )}
          </span>
          <span className="truncate text-[11.5px] text-fg-3">{workflowSummary(workflow)}</span>
        </button>
        <WorkflowRowMenu profileName={profileName} workflow={workflow} />
        <WorkflowRunButton
          profileName={profileName}
          workflowName={workflow.name}
          active={!!progress}
        />
      </div>
      {progress && <WorkflowProgress workflow={workflow} progress={progress} />}
    </li>
  );
};
