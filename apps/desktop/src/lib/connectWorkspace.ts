import type { DockviewApi } from "dockview-react";

import { limitInjectHeight, loadLayout, saveLayout, showPanel } from "@/lib/dockLayout";
import { layoutStore, setDockApi } from "@/stores/layoutStore";
import { workflowPanelStore } from "@/stores/workflowPanelStore";

const syncWorkflows = () => {
  const { api } = layoutStore.getState();
  if (api) showPanel(api, "workflows", workflowPanelStore.getState().open);
};

export const connectWorkspace = (api: DockviewApi, size: () => DOMRect) => {
  const { width, height } = size();
  api.layout(width, height);
  loadLayout(api);
  const handleLayoutChange = () => {
    limitInjectHeight(api);
    saveLayout(api);
  };
  handleLayoutChange();
  api.onDidLayoutChange(handleLayoutChange);
  setDockApi(api);
};

export const watchPanelVisibility = () => {
  syncWorkflows();
  const unsubscribeWorkflows = workflowPanelStore.subscribe(syncWorkflows);
  const unsubscribeLayout = layoutStore.subscribe(syncWorkflows);

  return () => {
    unsubscribeWorkflows();
    unsubscribeLayout();
  };
};
