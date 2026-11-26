import type { FC } from "react";

import { DockPanel } from "@/components/DockPanel";
import { LogPanel } from "@/components/LogPanel";
import { SelectedProfile } from "@/components/SelectedProfile";

export const LogDockPanel: FC = () => (
  <DockPanel panelId="log">
    <SelectedProfile>
      {(profile) => <LogPanel key={profile.name} profileName={profile.name} />}
    </SelectedProfile>
  </DockPanel>
);
