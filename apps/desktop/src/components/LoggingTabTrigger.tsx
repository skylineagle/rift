import type { FC } from "react";

import { TabsTrigger } from "@/components/ui/tabs";
import type { Destination } from "@/lib/loggingSettings";
import { cn } from "@/lib/utils";

export type LoggingTabTriggerProps = {
  value: Destination;
  label: string;
  enabled: boolean;
  invalid: boolean;
};

export const LoggingTabTrigger: FC<LoggingTabTriggerProps> = ({ value, label, enabled, invalid }) => {
  const status = invalid ? "needs attention" : enabled ? "on" : "off";

  return (
    <TabsTrigger value={value} aria-label={`${label}, ${status}`}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", invalid ? "bg-err" : enabled ? "bg-ok" : "bg-fg-3/40")}
      />
      {label}
    </TabsTrigger>
  );
};
