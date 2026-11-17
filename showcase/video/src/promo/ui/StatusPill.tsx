import type { FC } from "react";

import { color } from "../tokens";

export type StatusPillProps = { label: string; live: boolean };

export const StatusPill: FC<StatusPillProps> = ({ label, live }) => (
  <span
    style={{
      display: "inline-flex",
      height: 20,
      flex: "none",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      background: color.surface3,
      padding: "0 8px",
      fontSize: 11.5,
      fontWeight: 500,
      whiteSpace: "nowrap",
      color: live ? color.ok : color.fg2,
    }}
  >
    <i style={{ width: 6, height: 6, borderRadius: "50%", background: live ? color.ok : color.fg3 }} />
    {label}
  </span>
);
