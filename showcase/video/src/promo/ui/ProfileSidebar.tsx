import { Plus, Server, Upload } from "lucide-react";
import type { FC } from "react";

import { app } from "../layout";
import { color } from "../tokens";
import { ProfileRow } from "./ProfileRow";
import type { DotStatus } from "./StatusDot";

export type SidebarProfile = { name: string; status: DotStatus; opacity: number };

export type ProfileSidebarProps = { profiles: SidebarProfile[]; selected: string };

export const ProfileSidebar: FC<ProfileSidebarProps> = ({ profiles, selected }) => (
  <aside style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: `1px solid ${color.line}`, background: color.surface2 }}>
    <div style={{ display: "flex", height: 38, alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 12px", color: color.fg3 }}>
      <Server size={14} />
      <span style={{ display: "flex", gap: 14, paddingRight: 6 }}>
        <Upload size={14} />
        <Plus size={14} />
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: app.profileGap, padding: "2px 6px" }}>
      {profiles.map((profile) => (
        <ProfileRow key={profile.name} name={profile.name} status={profile.status} opacity={profile.opacity} selected={profile.name === selected} />
      ))}
    </div>
  </aside>
);
