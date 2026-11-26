import type { FC } from "react";

import { BridgeSection } from "@/components/BridgeSection";
import { InjectBar } from "@/components/InjectBar";
import { LogPanel } from "@/components/LogPanel";
import { ProfileHeader } from "@/components/ProfileHeader";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { useStore } from "@/hooks/useStore";
import type { Profile } from "@/lib/types";
import { workflowPanelStore } from "@/stores/workflowPanelStore";

export type MainPanelProps = { profile: Profile };

export const MainPanel: FC<MainPanelProps> = ({ profile }) => {
  const workflowsOpen = useStore(workflowPanelStore, (state) => state.open);

  return (
    <main className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto]">
      <ProfileHeader name={profile.name} />
      <BridgeSection profile={profile} />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)]">
        <LogPanel profileName={profile.name} />
        {workflowsOpen && <WorkflowPanel profile={profile} />}
      </div>
      <InjectBar profileName={profile.name} />
    </main>
  );
};
