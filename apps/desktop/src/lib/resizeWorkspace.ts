import type { DockviewApi } from "dockview-react";

import { isStackedVertically } from "@/lib/layoutTree";
import type { PanelId } from "@/lib/panels";

const FIXED_ON_WINDOW_RESIZE: { id: PanelId; dimension: "width" | "height" }[] = [
  { id: "profiles", dimension: "width" },
  { id: "workflows", dimension: "width" },
  { id: "endpoints", dimension: "height" },
];

export const resizeWorkspace = (api: DockviewApi, width: number, height: number) => {
  const layout = api.toJSON();
  const kept = FIXED_ON_WINDOW_RESIZE.flatMap(({ id, dimension }) => {
    const group = api.getPanel(id)?.group;
    const alongSplit = isStackedVertically(layout, id) === (dimension === "height");
    return group?.api.isVisible && alongSplit
      ? [{ group, size: { [dimension]: group.api[dimension] } }]
      : [];
  });
  api.layout(width, height);
  kept.forEach(({ group, size }) => group.api.setSize(size));
};
