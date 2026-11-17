import { Moon } from "lucide-react";
import type { FC } from "react";
import { Img, staticFile } from "remotion";

import { app } from "../layout";
import { color } from "../tokens";
import { TrafficLights } from "./TrafficLights";
import { UpdateReadyPill } from "./UpdateReadyPill";

export type TitleBarProps = { update: number };

export const TitleBar: FC<TitleBarProps> = ({ update }) => (
  <div style={{ position: "relative", display: "flex", height: app.title, flex: "none", alignItems: "center", gap: 12, borderBottom: `1px solid ${color.line}`, background: color.surface2, padding: "0 10px 0 78px" }}>
    <TrafficLights />
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
      <Img src={staticFile("icon.svg")} alt="" style={{ width: 16, height: 16, borderRadius: 4 }} />
      Rift
    </span>
    <span style={{ flex: 1 }} />
    {update > 0 ? <UpdateReadyPill version="0.2.1" opacity={update} /> : null}
    <span style={{ display: "grid", placeItems: "center", width: 28, color: color.fg3 }}>
      <Moon size={14} />
    </span>
  </div>
);
