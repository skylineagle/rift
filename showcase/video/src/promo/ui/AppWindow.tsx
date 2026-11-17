import { Play, Square } from "lucide-react";
import type { CSSProperties, FC } from "react";

import { app, type Placement } from "../layout";
import { color, font } from "../tokens";
import { BridgeStrip } from "./BridgeStrip";
import { InjectBar, type InjectBarProps } from "./InjectBar";
import { LogList, type ShownRow } from "./LogList";
import { LogToolbar } from "./LogToolbar";
import { ProfileSidebar, type SidebarProfile } from "./ProfileSidebar";
import { TitleBar } from "./TitleBar";

export type WindowState = {
  profiles: SidebarProfile[];
  selected: string;
  live: boolean;
  rows: ShownRow[];
  hex: number;
  expandedId?: number;
  reveal: number;
  events: number;
  inject: InjectBarProps;
  update: number;
  sentA: string;
  sentB: string;
};

export type AppWindowProps = { placement: Placement; state: WindowState; style?: CSSProperties };

const listHeight = app.height - app.title - app.header - app.strip - app.toolbar - app.inject;

export const AppWindow: FC<AppWindowProps> = ({ placement, state, style }) => (
  <div
    style={{
      position: "absolute",
      left: placement.x,
      top: placement.y,
      width: app.width,
      height: app.height,
      scale: String(placement.scale),
      transformOrigin: "0 0",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: 10,
      border: `1px solid ${color.line2}`,
      background: color.surface,
      color: color.fg,
      fontFamily: font.ui,
      fontSize: 13,
      lineHeight: 1.5,
      WebkitFontSmoothing: "antialiased",
      ...style,
    }}
  >
    <TitleBar update={state.update} />
    <div style={{ display: "grid", flex: 1, minHeight: 0, gridTemplateColumns: `${app.sidebar}px minmax(0,1fr)` }}>
      <ProfileSidebar profiles={state.profiles} selected={state.selected} />
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", height: app.header, alignItems: "center", justifyContent: "space-between", padding: "0 14px", fontSize: 15, fontWeight: 650 }}>
          {state.selected}
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: state.live ? color.fg : color.fg2, fontSize: 12, fontWeight: 500 }}>
            {state.live ? <Square size={12} fill={color.fg} /> : <Play size={12} />}
            {state.live ? "Stop" : "Start"}
          </span>
        </div>
        <BridgeStrip live={state.live} sentA={state.sentA} sentB={state.sentB} />
        <LogToolbar events={state.events} viewIndex={state.hex} />
        <LogList rows={state.rows} hex={state.hex > 0.5} expandedId={state.expandedId} reveal={state.reveal} height={listHeight} />
        <InjectBar {...state.inject} />
      </main>
    </div>
  </div>
);
