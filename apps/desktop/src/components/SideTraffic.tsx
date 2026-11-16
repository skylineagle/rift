import type { FC } from "react";

import { formatBytes, formatRate } from "@/lib/format";
import type { SideName } from "@/lib/types";
import type { SideCounters } from "@/stores/bridgeStore";

export type SideTrafficProps = {
  side: SideName;
  counters: SideCounters;
  rates: SideCounters;
};

export const SideTraffic: FC<SideTrafficProps> = ({ side, counters, rates }) => (
  <span className="flex max-w-full shrink items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] font-medium tabular-nums text-fg-2">
    {(["received", "sent"] as const).map((direction) => {
      const description = `${direction === "received" ? "Received from" : "Sent successfully to"} side ${side} connection${direction === "sent" ? ", including injections" : ""}: ${formatRate(rates[direction])}; ${formatBytes(counters[direction])} since side ${side} was last paused`;
      return (
        <span key={direction} role="group" tabIndex={0} title={description} aria-label={description} className="inline-flex items-baseline gap-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <span aria-hidden="true" className={side === "A" ? "text-ab" : "text-ba"}>{direction === "received" ? "↓" : "↑"}</span>
          <span aria-hidden="true">{formatRate(rates[direction])}</span>
          <span aria-hidden="true" className="text-fg-3">·</span>
          <span aria-hidden="true" className="text-fg-3">{formatBytes(counters[direction])}</span>
        </span>
      );
    })}
  </span>
);
