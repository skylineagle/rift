import { ArrowUpCircle } from "lucide-react";
import { useState, type FC } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/hooks/useStore";
import { bridgeStore } from "@/stores/bridgeStore";
import { installUpdate } from "@/stores/updateStore";

export type UpdateReadyPillProps = { version: string; pillClassName: string };

const READY_STYLE = "border-accent-line bg-accent-soft text-accent-text hover:bg-accent-soft/80";

export const UpdateReadyPill: FC<UpdateReadyPillProps> = ({ version, pillClassName }) => {
  const running = useStore(
    bridgeStore,
    (state) => Object.values(state.bridges).filter((bridge) => bridge.running).length,
  );
  const [confirming, setConfirming] = useState(false);
  const label = (
    <>
      <ArrowUpCircle className="size-3.5" />
      Rift {version} · Restart to update
    </>
  );

  if (running === 0) {
    return (
      <button type="button" className={`${pillClassName} ${READY_STYLE}`} onClick={installUpdate}>
        {label}
      </button>
    );
  }

  return (
    <Popover open={confirming} onOpenChange={setConfirming}>
      <PopoverTrigger asChild>
        <button type="button" className={`${pillClassName} ${READY_STYLE}`}>
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[290px] text-[12.5px]">
        <p className="font-semibold text-fg">Restart to install Rift {version}?</p>
        <p className="mt-2 rounded-md border border-warn/30 bg-warn/10 px-2 py-1.5 text-warn">
          {running} {running === 1 ? "bridge is" : "bridges are"} running. Restarting stops{" "}
          {running === 1 ? "it" : "them"}.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
            Later
          </Button>
          <Button size="sm" onClick={installUpdate}>
            Restart now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
