import { previewBox, resolveDrop, type Point } from "@/lib/panelDrop";
import { isPanelId, type PanelId } from "@/lib/panels";
import { setDrag, type PanelDrag } from "@/stores/layoutStore";

export const dragPanelTo = (source: PanelId, point: Point): PanelDrag => {
  const idle = { source, drop: null, preview: null, ...point };
  const element = document
    .elementFromPoint(point.x, point.y)
    ?.closest<HTMLElement>("[data-panel-id]");
  const workspace = element?.closest<HTMLElement>("[data-workspace]");
  const target = element?.dataset.panelId;
  if (!element || !workspace || !isPanelId(target)) return idle;

  const targetBox = element.getBoundingClientRect();
  const workspaceBox = workspace.getBoundingClientRect();
  const drop = resolveDrop({ source, target, point, targetBox, workspaceBox });
  return drop ? { ...idle, drop, preview: previewBox(drop, targetBox, workspaceBox) } : idle;
};

export const trackPanelDrag = (source: PanelId, point: Point) =>
  setDrag(dragPanelTo(source, point));
