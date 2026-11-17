import { ArrowLeftRight, ChevronDown, History, Send } from "lucide-react";
import type { FC } from "react";

import { app } from "../layout";
import { color, font } from "../tokens";
import { SegmentedControl } from "./SegmentedControl";

export type InjectBarProps = { value: string; focused: boolean; caret: boolean; pressed: number; bytes: number };

export const InjectBar: FC<InjectBarProps> = ({ value, focused, caret, pressed, bytes }) => (
  <div style={{ display: "flex", height: app.inject, alignItems: "center", gap: 6, borderTop: `1px solid ${color.line}`, background: color.surface2, padding: "0 12px" }}>
    <SegmentedControl items={["A", <ArrowLeftRight key="both" size={13} />, "B"]} index={2} />
    <span style={{ display: "flex", width: 84, height: 30, flex: "none", alignItems: "center", justifyContent: "space-between", borderRadius: 8, border: `1px solid ${color.line2}`, background: color.surface, padding: "0 8px", fontSize: 12.5 }}>
      Text
      <ChevronDown size={13} color={color.fg3} />
    </span>
    <span
      data-target="inject-input"
      style={{
        display: "flex",
        height: 30,
        minWidth: 0,
        flex: 1,
        alignItems: "center",
        gap: 8,
        borderRadius: 8,
        border: `1px solid ${focused ? color.amberLine : color.line2}`,
        boxShadow: focused ? `0 0 0 3px ${color.amberSoft}` : undefined,
        background: color.surface,
        padding: "0 10px",
      }}
    >
      <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700, color: color.amberText }}>›</span>
      <span style={{ fontFamily: font.mono, fontSize: 12.5, whiteSpace: "pre", color: value ? color.fg : color.fg3 }}>
        {value || (focused ? "" : "$PUBX,00*33\\r\\n")}
        {caret ? <i style={{ display: "inline-block", width: 1.5, height: 15, marginLeft: 1, verticalAlign: "-3px", background: color.fg }} /> : null}
      </span>
    </span>
    <span style={{ minWidth: 38, textAlign: "right", fontFamily: font.mono, fontSize: 11.5, color: color.fg3 }}>{bytes > 0 ? `${bytes} B` : ""}</span>
    <span style={{ display: "grid", width: 28, placeItems: "center", color: color.fg3 }}>
      <History size={14} />
    </span>
    <span
      data-target="send"
      style={{
        display: "grid",
        width: 30,
        height: 30,
        placeItems: "center",
        borderRadius: 8,
        background: color.amber,
        color: "#120a00",
        opacity: bytes > 0 || pressed > 0 ? 1 : 0.5,
        scale: String(1 - pressed * 0.06),
      }}
    >
      <Send size={14} />
    </span>
  </div>
);
