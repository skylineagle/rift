import type { FC } from "react";

import { BridgeSection } from "@/components/BridgeSection";
import { InjectBar } from "@/components/InjectBar";
import { LogPanel } from "@/components/LogPanel";
import { ProfileHeader } from "@/components/ProfileHeader";
import type { Profile } from "@/lib/types";

export type MainPanelProps = { profile: Profile };

export const MainPanel: FC<MainPanelProps> = ({ profile }) => (
  <main className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto]">
    <ProfileHeader name={profile.name} />
    <BridgeSection profile={profile} />
    <LogPanel profileName={profile.name} />
    <InjectBar profileName={profile.name} />
  </main>
);
