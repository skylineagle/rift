import type { AddPanelOptions, DockviewApi, SerializedDockview } from "dockview-react";

import { isStackedVertically, swapPanels } from "@/lib/layoutTree";
import type { PanelDrop, Side } from "@/lib/panelDrop";
import { PANEL_TITLES, type PanelId } from "@/lib/panels";

const STORAGE_KEY = "rift-layout";
const SIDEBAR_WIDTH = 212;
const WORKFLOWS_WIDTH = 320;
const ENDPOINTS_HEIGHT = 340;
const INJECT_HEIGHT = 47;
const UNBOUNDED = Number.MAX_SAFE_INTEGER;


const MINIMUM_SIZES: Record<PanelId, { minimumWidth: number; minimumHeight: number }> = {
  profiles: { minimumWidth: 160, minimumHeight: 120 },
  endpoints: { minimumWidth: 320, minimumHeight: 120 },
  log: { minimumWidth: 320, minimumHeight: 140 },
  workflows: { minimumWidth: 280, minimumHeight: 160 },
  inject: { minimumWidth: 560, minimumHeight: INJECT_HEIGHT },
};

const addPanel = (api: DockviewApi, id: PanelId, position?: AddPanelOptions["position"]) => {
  const panel = api.addPanel({
    id,
    component: id,
    title: PANEL_TITLES[id],
    position,
    ...MINIMUM_SIZES[id],
  });
  panel.group.header.hidden = true;
  return panel;
};

const addDefaultPanels = (api: DockviewApi) => {
  const profiles = addPanel(api, "profiles");
  const log = addPanel(api, "log", { referencePanel: "profiles", direction: "right" });
  const endpoints = addPanel(api, "endpoints", { referencePanel: "log", direction: "above" });
  const inject = addPanel(api, "inject", { referencePanel: "log", direction: "below" });
  const workflows = addPanel(api, "workflows", { referencePanel: "log", direction: "right" });
  inject.group.api.setConstraints({ maximumHeight: INJECT_HEIGHT });
  profiles.group.api.setSize({ width: SIDEBAR_WIDTH });
  endpoints.group.api.setSize({ height: ENDPOINTS_HEIGHT });
  workflows.group.api.setSize({ width: WORKFLOWS_WIDTH });
  log.api.setActive();
};

const readLayout = (): SerializedDockview | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as SerializedDockview) : null;
  } catch {
    return null;
  }
};

export const saveLayout = (api: DockviewApi) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(api.toJSON()));
  } catch {
    return;
  }
};

const restoreLayout = (api: DockviewApi) => {
  const layout = readLayout();
  if (!layout) return false;
  try {
    api.fromJSON(layout);
  } catch {
    api.clear();
    return false;
  }
  const complete = Object.keys(PANEL_TITLES).every((id) => api.getPanel(id));
  if (!complete) api.clear();
  return complete;
};

export const loadLayout = (api: DockviewApi) => {
  if (!restoreLayout(api)) addDefaultPanels(api);
};

export const resetLayout = (api: DockviewApi) => {
  api.clear();
  addDefaultPanels(api);
};

export const limitInjectHeight = (api: DockviewApi) => {
  const group = api.getPanel("inject")?.group;
  if (!group) return;
  const maximumHeight = isStackedVertically(api.toJSON(), "inject") ? INJECT_HEIGHT : UNBOUNDED;
  if (group.maximumHeight !== maximumHeight) group.api.setConstraints({ maximumHeight });
};

export const showPanel = (api: DockviewApi, id: PanelId, visible: boolean) => {
  const group = api.getPanel(id)?.group;
  if (group && group.api.isVisible !== visible) group.api.setVisible(visible);
};

const moveBeside = (api: DockviewApi, source: PanelId, target: PanelId, side: Side) => {
  const group = api.getPanel(source)?.group;
  const destination = api.getPanel(target)?.group;
  if (group && destination) group.api.moveTo({ group: destination, position: side });
};

const moveToWindowEdge = (api: DockviewApi, source: PanelId, side: "left" | "right") => {
  const group = api.getPanel(source)?.group;
  if (!group) return;
  const { width } = group.api;
  const destination = api.addGroup({ direction: side });
  group.api.moveTo({ group: destination, position: "center" });
  api.getPanel(source)?.group.api.setSize({ width });
};

export const applyDrop = (api: DockviewApi, source: PanelId, drop: PanelDrop) => {
  if (drop.kind === "swap") {
    api.fromJSON(swapPanels(api.toJSON(), source, drop.target), { reuseExistingPanels: true });
  } else if (drop.kind === "split") {
    moveBeside(api, source, drop.target, drop.side);
  } else {
    moveToWindowEdge(api, source, drop.side);
  }
  api.getPanel(source)!.group.header.hidden = true;
};
