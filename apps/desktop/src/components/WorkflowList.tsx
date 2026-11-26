import { useState, type FC } from "react";

import { QuickRepeatForm } from "@/components/QuickRepeatForm";
import { WorkflowCreateMenu } from "@/components/WorkflowCreateMenu";
import { WorkflowEmptyState } from "@/components/WorkflowEmptyState";
import { WorkflowRow } from "@/components/WorkflowRow";
import type { Profile } from "@/lib/types";

export type WorkflowListProps = { profile: Profile };

export const WorkflowList: FC<WorkflowListProps> = ({ profile }) => {
  const [repeating, setRepeating] = useState(false);
  const workflows = profile.workflows ?? [];

  return (
    <>
      <header className="flex h-10 flex-none items-center gap-2 pr-2 pl-3">
        <h2 className="m-0 text-[13px] font-[650]">Workflows</h2>
        <span className="font-mono text-[11px] text-fg-3">{workflows.length || ""}</span>
        <span className="flex-1" />
        <WorkflowCreateMenu profile={profile} onRepeatSend={() => setRepeating(true)} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {workflows.length === 0 && <WorkflowEmptyState profile={profile} />}
        {workflows.length > 0 && repeating && (
          <div className="mb-2 rounded-xl border border-line bg-surface p-3">
            <QuickRepeatForm
              profile={profile}
              onCancel={() => setRepeating(false)}
              onCreated={() => setRepeating(false)}
            />
          </div>
        )}
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {workflows.map((workflow) => (
            <WorkflowRow key={workflow.name} profileName={profile.name} workflow={workflow} />
          ))}
        </ul>
      </div>
    </>
  );
};
