import type { FC } from "react";

import { SeamStream } from "@/components/SeamStream";
import { SideCard } from "@/components/SideCard";
import type { Profile } from "@/lib/types";

export type BridgeSectionProps = { profile: Profile };

export const BridgeSection: FC<BridgeSectionProps> = ({ profile }) => (
  <div className="grid grid-cols-1 items-stretch gap-2.5 px-3.5 pt-1.5 pb-3.5 @[720px]:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)] @[720px]:gap-0">
    <SideCard profileName={profile.name} side="A" endpoint={profile.a} />
    <SeamStream profileName={profile.name} />
    <SideCard profileName={profile.name} side="B" endpoint={profile.b} />
  </div>
);
