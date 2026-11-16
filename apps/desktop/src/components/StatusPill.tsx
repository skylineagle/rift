import type { FC } from "react";

import { statusLabel, type SideStatusName } from "@/lib/sideStatus";
import type { EndpointKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export type StatusPillProps = { kind: EndpointKind; status: SideStatusName };

const TEXT_CLASSES: Record<SideStatusName, string> = {
  idle: "text-fg-2",
  disconnected: "text-fg-2",
  connected: "text-ok",
  listening: "text-ok",
  connecting: "text-warn",
  error: "bg-err-soft text-err",
  disabled: "text-fg-3",
};

const MARK_CLASSES: Record<SideStatusName, string> = {
  idle: "bg-fg-3",
  disconnected: "bg-fg-3",
  connected: "bg-ok",
  listening: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--ok)]",
  connecting: "bg-warn",
  error: "bg-err",
  disabled: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--fg-3)]",
};

export const StatusPill: FC<StatusPillProps> = ({ kind, status }) => (
  <span
    className={cn(
      "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[10px] bg-surface-3 px-2 text-[11.5px] font-medium whitespace-nowrap",
      TEXT_CLASSES[status],
    )}
  >
    <i className={cn("size-1.5 rounded-full", MARK_CLASSES[status])} />
    {statusLabel(kind, status)}
  </span>
);
