import { Plus, Server } from "lucide-react";
import type { FC } from "react";

import { ConfigDropOverlay } from "@/components/ConfigDropOverlay";
import { Hint } from "@/components/Hint";
import { ImportConfigButton } from "@/components/ImportConfigButton";
import { ProfileRow } from "@/components/ProfileRow";
import { TooltipButton } from "@/components/TooltipButton";
import { useConfigDropZone } from "@/hooks/useConfigDropZone";
import { useProfiles } from "@/hooks/useProfiles";
import { useStore } from "@/hooks/useStore";
import { createProfile, profilesStore } from "@/stores/profilesStore";

export const ProfileSidebar: FC = () => {
  const profiles = useProfiles();
  const selectedName = useStore(profilesStore, (state) => state.selectedName);
  const { over, attach, browserHandlers } = useConfigDropZone();

  return (
    <aside
      ref={attach}
      {...browserHandlers}
      className="relative flex min-h-0 flex-col bg-surface-2"
    >
      <div className="flex items-center justify-between py-2 pr-2 pl-3 text-fg-3">
        <Hint text="Profiles">
          <span className="flex">
            <Server className="size-3.5" />
          </span>
        </Hint>
        <div className="flex items-center">
          <ImportConfigButton />
          <TooltipButton
            variant="ghost"
            size="icon"
            tip="New profile"
            onClick={createProfile}
          >
            <Plus />
          </TooltipButton>
        </div>
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
      <ConfigDropOverlay visible={over} />
    </aside>
  );
};
