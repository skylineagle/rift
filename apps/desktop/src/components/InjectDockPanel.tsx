import type { FC } from "react";

import { DockPanel } from "@/components/DockPanel";
import { InjectBar } from "@/components/InjectBar";
import { SelectedProfile } from "@/components/SelectedProfile";

export const InjectDockPanel: FC = () => (
  <DockPanel panelId="inject">
    <SelectedProfile>
      {(profile) => <InjectBar key={profile.name} profileName={profile.name} />}
    </SelectedProfile>
  </DockPanel>
);
