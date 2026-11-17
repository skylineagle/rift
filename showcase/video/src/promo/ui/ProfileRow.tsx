import type { FC } from "react";

import { app } from "../layout";
import { color } from "../tokens";
import { StatusDot, type DotStatus } from "./StatusDot";

export type ProfileRowProps = { name: string; selected: boolean; status: DotStatus; opacity: number };

export const ProfileRow: FC<ProfileRowProps> = ({ name, selected, status, opacity }) => (
  <div
    data-target={`profile-${name}`}
    style={{
      display: "grid",
      height: app.profileRow,
      gridTemplateColumns: "8px minmax(0,1fr)",
      alignItems: "center",
      gap: 8,
      borderRadius: 8,
      padding: "0 8px",
      background: selected ? color.surface4 : "transparent",
      opacity,
      translate: `0 ${(1 - opacity) * -4}px`,
    }}
  >
    <StatusDot status={status} />
    <b style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b>
  </div>
);
