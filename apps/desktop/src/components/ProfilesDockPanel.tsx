import type { FC } from "react";

import { DockPanel } from "@/components/DockPanel";
import { ProfileSidebar } from "@/components/ProfileSidebar";

export const ProfilesDockPanel: FC = () => (
  <DockPanel panelId="profiles">
    <ProfileSidebar />
  </DockPanel>
);
