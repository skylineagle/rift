import { useId, type FC, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import type { Destination } from "@/lib/loggingSettings";

export type LoggingSinkPanelProps = {
  value: Destination;
  label: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
};

export const LoggingSinkPanel: FC<LoggingSinkPanelProps> = ({
  value,
  label,
  enabled,
  onEnabledChange,
  children,
}) => {
  const switchId = useId();

  return (
    <TabsContent
      forceMount
      value={value}
      className="flex min-w-0 flex-col gap-3 [grid-area:1/1] data-[state=inactive]:invisible"
    >
      <div className="flex h-9 items-center justify-between rounded-lg border border-line bg-surface-2 px-3">
        <label htmlFor={switchId} className="text-[12.5px] font-medium">{label}</label>
        <Switch id={switchId} checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      <fieldset
        disabled={!enabled}
        className="m-0 min-w-0 border-0 p-0 transition-opacity duration-150 disabled:opacity-45"
      >
        <div className="grid grid-cols-2 content-start items-start gap-x-2.5 gap-y-3">{children}</div>
      </fieldset>
    </TabsContent>
  );
};
