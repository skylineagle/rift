import type { FC } from "react";

import { DockPanel } from "@/components/DockPanel";
import { SelectedProfile } from "@/components/SelectedProfile";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { useStore } from "@/hooks/useStore";
import { workflowPanelStore } from "@/stores/workflowPanelStore";

export const WorkflowsDockPanel: FC = () => {
  const open = useStore(workflowPanelStore, (state) => state.open);

  return (
    <DockPanel panelId="workflows">
      <SelectedProfile>
        {(profile) => open && <WorkflowPanel key={profile.name} profile={profile} />}
      </SelectedProfile>
    </DockPanel>
  );
};
