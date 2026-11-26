import type { FC } from "react";

import { QuickRepeatForm } from "@/components/QuickRepeatForm";
import type { Profile } from "@/lib/types";

export type WorkflowEmptyStateProps = { profile: Profile };

export const WorkflowEmptyState: FC<WorkflowEmptyStateProps> = ({ profile }) => (
  <div className="flex flex-col gap-3 px-1 pt-1">
    <p className="m-0 text-xs leading-relaxed text-fg-3">
      Workflows send payloads for you, on a timer or as a sequence of steps. Start with a
      repeated send.
    </p>
    <div className="rounded-xl border border-line bg-surface p-3">
      <QuickRepeatForm profile={profile} />
    </div>
  </div>
);
