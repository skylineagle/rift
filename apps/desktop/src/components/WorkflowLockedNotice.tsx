import type { FC } from "react";

import { Button } from "@/components/ui/button";

export type WorkflowLockedNoticeProps = { onStop: () => void };

export const WorkflowLockedNotice: FC<WorkflowLockedNoticeProps> = ({ onStop }) => (
  <div
    role="status"
    className="mx-3 mb-2 flex flex-none items-center gap-2 rounded-lg bg-accent-soft py-1.5 pr-1.5 pl-2.5"
  >
    <span aria-hidden="true" className="size-1.5 animate-pulse-dot rounded-full bg-amber" />
    <span className="flex-1 text-xs text-accent-text">Running, editing is locked</span>
    <Button type="button" variant="secondary" size="sm" onClick={onStop}>
      Stop to edit
    </Button>
  </div>
);
