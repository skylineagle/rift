import type { DockviewApi } from "dockview-react";

import { applyDrop, resetLayout } from "@/lib/dockLayout";
import { createStore } from "@/lib/createStore";
import type { Box, PanelDrop } from "@/lib/panelDrop";
import type { PanelId } from "@/lib/panels";

export type PanelDrag = {
  source: PanelId;
  drop: PanelDrop | null;
  preview: Box | null;
  x: number;
  y: number;
};

type LayoutState = {
  api: DockviewApi | null;
  locked: boolean;
  held: boolean;
  drag: PanelDrag | null;
};

export const layoutStore = createStore<LayoutState>({
  api: null,
  locked: false,
  held: false,
  drag: null,
});

export const isReordering = ({ locked, held, drag }: LayoutState) =>
  locked || held || drag !== null;

export const setDockApi = (api: DockviewApi | null) =>
  layoutStore.setState((state) => ({ ...state, api }));

export const toggleReorder = () =>
  layoutStore.setState((state) => ({ ...state, locked: !state.locked }));

export const setHeld = (held: boolean) =>
  layoutStore.setState((state) => (state.held === held ? state : { ...state, held }));

export const exitReorder = () =>
  layoutStore.setState((state) => ({ ...state, locked: false, held: false, drag: null }));

export const setDrag = (drag: PanelDrag | null) =>
  layoutStore.setState((state) => ({ ...state, drag }));

export const finishDrag = () => {
  const { api, drag } = layoutStore.getState();
  setDrag(null);
  if (api && drag?.drop) applyDrop(api, drag.source, drag.drop);
};

export const restoreDefaultLayout = () => {
  const { api } = layoutStore.getState();
  if (api) resetLayout(api);
};
