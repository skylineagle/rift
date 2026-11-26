import { toast } from "@yusufceng1z/ding-react";
import { Settings2 } from "lucide-react";
import { useState, type FC } from "react";

import { LoggingSettingsDialog } from "@/components/LoggingSettingsDialog";
import { TooltipButton } from "@/components/TooltipButton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useStore } from "@/hooks/useStore";
import { errorMessage } from "@/lib/format";
import { hasEnabledSink } from "@/lib/loggingSettings";
import * as api from "@/lib/tauriApi";
import type { LoggingConfig } from "@/lib/types";
import { loggingStore, refreshLoggingConfig } from "@/stores/loggingStore";

type LoggingSession = { config: LoggingConfig; defaultDirectory: string };

export const LoggingSettingsButton: FC = () => {
  const active = useStore(loggingStore, hasEnabledSink);
  const [session, setSession] = useState<LoggingSession | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [config, defaultDirectory] = await Promise.all([
        refreshLoggingConfig(),
        api.defaultLogDirectory(),
      ]);
      setSession({ config, defaultDirectory });
      setOpen(true);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const changeOpen = (next: boolean) => {
    if (next) load();
    else setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <TooltipButton variant="ghost" size="icon" tip="Logging settings" className="relative">
          <Settings2 />
          {active && (
            <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-amber" />
          )}
        </TooltipButton>
      </DialogTrigger>
      <DialogContent>
        {session && (
          <LoggingSettingsDialog
            saved={session.config}
            defaultDirectory={session.defaultDirectory}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
