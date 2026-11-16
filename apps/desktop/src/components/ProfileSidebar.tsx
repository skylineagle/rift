import { Plus, Server } from "lucide-react";
import type { FC } from "react";

import { ConfigImport } from "@/components/ConfigImport";
import { Hint } from "@/components/Hint";
import { ProfileRow } from "@/components/ProfileRow";
import { TooltipButton } from "@/components/TooltipButton";
import { useProfiles } from "@/hooks/useProfiles";
import { useStore } from "@/hooks/useStore";
import { createProfile, profilesStore } from "@/stores/profilesStore";

export const ProfileSidebar: FC = () => {
  const profiles = useProfiles();
  const selectedName = useStore(profilesStore, (state) => state.selectedName);

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-surface-2">
      <div className="flex items-center justify-between py-2 pr-2 pl-3 text-fg-3">
        <Hint text="Profiles">
          <span className="flex">
            <Server className="size-3.5" />
          </span>
        </Hint>
        <TooltipButton
          variant="ghost"
          size="icon"
          tip="New profile"
          onClick={createProfile}
        >
          <Plus />
        </TooltipButton>
      </div>
      <div className="flex flex-1 flex-col gap-px overflow-auto px-1.5 py-0.5">
        {profiles.map((profile) => (
          <ProfileRow
            key={profile.name}
            name={profile.name}
            selected={profile.name === selectedName}
          />
        ))}
      </div>
      <ConfigImport />
    </aside>
  );
};
