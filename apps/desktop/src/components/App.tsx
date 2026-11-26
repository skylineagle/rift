import { Toaster } from "@yusufceng1z/ding-react";
import type { FC } from "react";

import { EmptyProfiles } from "@/components/EmptyProfiles";
import { DockWorkspace } from "@/components/DockWorkspace";
import { ProfileSidebar } from "@/components/ProfileSidebar";
import { TitleBar } from "@/components/TitleBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSelectedProfile } from "@/hooks/useProfiles";
import { useTheme } from "@/hooks/useTheme";

export const App: FC = () => {
  const profile = useSelectedProfile();
  const theme = useTheme();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-surface">
        <TitleBar />
        {profile ? (
          <DockWorkspace />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[212px_minmax(0,1fr)]">
            <div className="grid min-h-0 border-r border-line">
              <ProfileSidebar />
            </div>
            <EmptyProfiles />
          </div>
        )}
      </div>
      <Toaster position="top-center" theme={theme} />
    </TooltipProvider>
  );
};
