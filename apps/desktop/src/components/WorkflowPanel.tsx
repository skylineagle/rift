import type { FC } from "react";

import { WorkflowEditor } from "@/components/WorkflowEditor";
import { WorkflowList } from "@/components/WorkflowList";
import { useStore } from "@/hooks/useStore";
import type { Profile } from "@/lib/types";
import { workflowPanelStore } from "@/stores/workflowPanelStore";

export type WorkflowPanelProps = { profile: Profile };

export const WorkflowPanel: FC<WorkflowPanelProps> = ({ profile }) => {
  const editor = useStore(workflowPanelStore, (state) => state.editor);

  return (
    <aside
      aria-label="Workflows"
      className="flex min-h-0 w-[320px] flex-col border-t border-l border-line bg-surface-2"
    >
      {editor?.profile === profile.name ? (
        <WorkflowEditor key={editor.id} profile={profile} session={editor} />
      ) : (
        <WorkflowList profile={profile} />
      )}
    </aside>
  );
};
