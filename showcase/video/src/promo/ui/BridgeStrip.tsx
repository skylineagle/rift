import { ArrowLeft, ArrowRight } from "lucide-react";
import type { FC } from "react";

import { app } from "../layout";
import { color, font } from "../tokens";
import { SideChip } from "./SideChip";
import { StatusPill } from "./StatusPill";

export type BridgeStripProps = { live: boolean; sentA: string; sentB: string };

export const BridgeStrip: FC<BridgeStripProps> = ({ live, sentA, sentB }) => (
  <div style={{ display: "grid", height: app.strip, gridTemplateColumns: "minmax(0,1fr) 120px minmax(0,1fr)", alignItems: "center", borderBottom: `1px solid ${color.line}`, padding: "0 14px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <SideChip side="A" />
      <b style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 500 }}>0.0.0.0:9000</b>
      <StatusPill label={live ? "Connected" : "Listening"} live={live} />
    </div>
    <div style={{ display: "grid", justifyItems: "center", gap: 2, fontFamily: font.mono, fontSize: 11, color: color.fg2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <ArrowRight size={12} color={color.amber} />
        {sentA}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <ArrowLeft size={12} color={color.cyan} />
        {sentB}
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 10, minWidth: 0 }}>
      <SideChip side="B" />
      <b style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 500 }}>ttyUSB0</b>
      <StatusPill label={live ? "Open" : "Stopped"} live={live} />
    </div>
  </div>
);
