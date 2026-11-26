import type { FC } from "react";

import { BridgeSection } from "@/components/BridgeSection";
import { DockPanel } from "@/components/DockPanel";
import { ProfileHeader } from "@/components/ProfileHeader";
import { SelectedProfile } from "@/components/SelectedProfile";

export const EndpointsDockPanel: FC = () => (
  <DockPanel panelId="endpoints">
    <SelectedProfile>
      {(profile) => (
        <div key={profile.name} className="@container min-h-0 overflow-auto">
          <ProfileHeader name={profile.name} />
          <BridgeSection profile={profile} />
        </div>
      )}
    </SelectedProfile>
  </DockPanel>
);
