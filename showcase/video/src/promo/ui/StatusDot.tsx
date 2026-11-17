import type { FC } from "react";

import { color } from "../tokens";

export type DotStatus = "idle" | "connected";

export type StatusDotProps = { status: DotStatus };

export const StatusDot: FC<StatusDotProps> = ({ status }) => (
  <span
    style={{
      width: 8,
      height: 8,
      flex: "none",
      borderRadius: "50%",
      background: status === "connected" ? color.ok : color.fg3,
      opacity: status === "connected" ? 1 : 0.55,
      boxShadow: status === "connected" ? `0 0 0 3px ${color.okRing}` : undefined,
    }}
  />
);
