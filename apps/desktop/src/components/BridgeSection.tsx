import type { FC } from "react";

import { SeamStream } from "@/components/SeamStream";
import { SideCard } from "@/components/SideCard";
import type { Profile } from "@/lib/types";

export type BridgeSectionProps = { profile: Profile };

export const BridgeSection: FC<BridgeSectionProps> = ({ profile }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)] items-stretch border-b border-line px-3.5 pt-1.5 pb-3.5">
    <SideCard profileName={profile.name} side="A" endpoint={profile.a} />
    <SeamStream profileName={profile.name} />
    <SideCard profileName={profile.name} side="B" endpoint={profile.b} />
  </div>
);
