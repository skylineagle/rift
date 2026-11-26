import { createStore } from "@/lib/createStore";
import type { Workflow } from "@/lib/types";
import { requestWorkflowPreviews } from "@/stores/payloadPreviewStore";

export type EditorSession = {
  id: number;
  profile: string;
  previousName: string | null;
  workflow: Workflow;
};

type WorkflowPanelState = { open: boolean; editor: EditorSession | null };

export const workflowPanelStore = createStore<WorkflowPanelState>({ open: false, editor: null });

let sessions = 0;

export const openWorkflowPanel = () =>
  workflowPanelStore.setState((state) => ({ ...state, open: true }));

export const toggleWorkflowPanel = () =>
  workflowPanelStore.setState((state) => ({ open: !state.open, editor: null }));

export const openEditor = (profile: string, workflow: Workflow, previousName: string | null) => {
  requestWorkflowPreviews(workflow);
  sessions += 1;
  const editor = { id: sessions, profile, previousName, workflow };
  workflowPanelStore.setState((state) => ({ ...state, editor }));
};

export const closeEditor = () =>
  workflowPanelStore.setState((state) => ({ ...state, editor: null }));
