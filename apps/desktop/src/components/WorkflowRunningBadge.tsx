import { Play } from "lucide-react";
import type { FC } from "react";

import { useStore } from "@/hooks/useStore";
import { selectRunning, workflowRunStore } from "@/stores/workflowRunStore";

export type WorkflowRunningBadgeProps = { profileName: string };

export const WorkflowRunningBadge: FC<WorkflowRunningBadgeProps> = ({ profileName }) => {
  const count = useStore(workflowRunStore, (state) => selectRunning(state, profileName).length);
  if (count === 0) return null;
  const label = `${count} ${count === 1 ? "workflow" : "workflows"} running`;

  return (
    <span
      title={label}
      aria-label={label}
      className="flex h-4 items-center gap-0.5 rounded-[5px] bg-accent-soft px-1 font-mono text-[10px] leading-none font-bold text-accent-text group-focus-within:hidden group-hover:hidden"
    >
      <Play aria-hidden="true" className="size-2 fill-current" />
      {count}
    </span>
  );
};
