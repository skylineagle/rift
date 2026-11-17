import { ArrowLeft, ArrowLeftRight, ArrowRight, MoreHorizontal, Pause, Search } from "lucide-react";
import type { FC } from "react";

import { app } from "../layout";
import { color } from "../tokens";
import { SegmentedControl } from "./SegmentedControl";

export type LogToolbarProps = { events: number; viewIndex: number };

const DIRECTIONS = [<ArrowLeftRight key="all" size={13} />, "A", "B", <ArrowRight key="ab" size={13} />, <ArrowLeft key="ba" size={13} />];

export const LogToolbar: FC<LogToolbarProps> = ({ events, viewIndex }) => (
  <div style={{ display: "flex", height: app.toolbar, flex: "none", alignItems: "center", gap: 6, padding: "0 12px" }}>
    <SegmentedControl items={DIRECTIONS} index={0} />
    <span style={{ display: "flex", height: 26, width: 160, alignItems: "center", gap: 6, borderRadius: 7, border: `1px solid ${color.line2}`, background: color.surface, padding: "0 8px", color: color.fg3, fontSize: 12 }}>
      <Search size={13} />
      Filter
    </span>
    <span style={{ flex: 1 }} />
    <span style={{ marginRight: 4, fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: color.fg3 }}>{events.toLocaleString("en-US")}</span>
    <SegmentedControl items={["Aa", "0x"]} index={viewIndex} target="view-toggle" />
    <span style={{ display: "grid", width: 28, placeItems: "center", color: color.fg2 }}>
      <Pause size={14} />
    </span>
    <span style={{ display: "grid", width: 28, placeItems: "center", color: color.fg2 }}>
      <MoreHorizontal size={14} />
    </span>
  </div>
);
