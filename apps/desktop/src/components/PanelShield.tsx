import { GripVertical } from "lucide-react";
import type { FC } from "react";

import { trackPanelDrag } from "@/lib/panelDragging";
import { PANEL_TITLES, type PanelId } from "@/lib/panels";
import { finishDrag, setDrag } from "@/stores/layoutStore";

export type PanelShieldProps = { panelId: PanelId };

export const PanelShield: FC<PanelShieldProps> = ({ panelId }) => (
  <div
    aria-label={`Move ${PANEL_TITLES[panelId]} panel`}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      trackPanelDrag(panelId, { x: event.clientX, y: event.clientY });
    }}
    onPointerMove={(event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      trackPanelDrag(panelId, { x: event.clientX, y: event.clientY });
    }}
    onPointerUp={finishDrag}
    onPointerCancel={() => setDrag(null)}
    className="absolute inset-0 z-20 flex animate-in cursor-grab touch-none items-center justify-center bg-black/35 ring-1 ring-accent-line duration-150 ring-inset fade-in-0 hover:bg-accent-soft active:cursor-grabbing"
  >
    <span className="pointer-events-none flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface-4 px-3.5 py-1 text-xs whitespace-nowrap text-fg shadow-lg shadow-black/40">
      <GripVertical className="size-3.5 text-fg-2" />
      {PANEL_TITLES[panelId]}
    </span>
  </div>
);
