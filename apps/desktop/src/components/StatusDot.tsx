import type { FC } from "react";

import type { SideStatusName } from "@/lib/sideStatus";
import { cn } from "@/lib/utils";

export type StatusDotProps = { status: SideStatusName };

const STATUS_CLASSES: Record<SideStatusName, string> = {
  idle: "bg-fg-3 opacity-55",
  disconnected: "bg-fg-3 opacity-55",
  connected: "bg-ok shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok)_20%,transparent)]",
  listening: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--ok)]",
  connecting: "animate-pulse-dot bg-warn",
  error: "bg-err shadow-[0_0_0_3px_var(--err-soft)]",
  disabled: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--fg-3)] opacity-55",
};

export const StatusDot: FC<StatusDotProps> = ({ status }) => (
  <span
    className={cn(
      "size-2 shrink-0 rounded-full transition-[background-color,box-shadow,opacity] duration-200",
      STATUS_CLASSES[status],
    )}
  />
);
