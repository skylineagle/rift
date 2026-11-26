import { toast } from "@yusufceng1z/ding-react";

import { createStore } from "@/lib/createStore";
import { errorMessage } from "@/lib/format";
import * as api from "@/lib/tauriApi";
import type { RiftEvent } from "@/lib/types";
import {
  applyWorkflowEvent,
  runningWorkflowNames,
  seedWorkflowRuns,
  workflowRunKey,
  type WorkflowRuns,
} from "@/lib/workflowRuns";
import { subscribeToEvents } from "@/stores/eventStream";

export type WorkflowRunState = { runs: WorkflowRuns };

export const workflowRunStore = createStore<WorkflowRunState>({ runs: {} });

const namesCache = new WeakMap<WorkflowRuns, Map<string, string[]>>();

export const selectRunning = ({ runs }: WorkflowRunState, profile: string): string[] => {
  const cached = namesCache.get(runs) ?? new Map<string, string[]>();
  namesCache.set(runs, cached);
  const names = cached.get(profile) ?? runningWorkflowNames(runs, profile);
  cached.set(profile, names);
  return names;
};

export const selectProgress = ({ runs }: WorkflowRunState, profile: string, workflow: string) =>
  runs[workflowRunKey(profile, workflow)];

const updateRuns = (update: (runs: WorkflowRuns) => WorkflowRuns) =>
  workflowRunStore.setState((state) => {
    const runs = update(state.runs);
    return runs === state.runs ? state : { runs };
  });

const reportedKeys = new Set<string>();

const receive = (event: RiftEvent) => {
  if (event.type !== "workflow") return;
  reportedKeys.add(workflowRunKey(event.profile, event.workflow));
  updateRuns((runs) => applyWorkflowEvent(runs, event));
  if (event.state.state === "failed") {
    toast.error(`Workflow ${event.workflow} failed: ${event.state.message}`);
  }
};

subscribeToEvents(receive);

api
  .runningWorkflows()
  .then((statuses) => updateRuns((runs) => seedWorkflowRuns(runs, statuses, reportedKeys)))
  .catch(() => undefined);

const reportError = (error: unknown) => {
  toast.error(errorMessage(error));
};

export const startWorkflow = (profile: string, workflow: string) =>
  api.startWorkflow(profile, workflow).catch(reportError);

export const stopWorkflow = (profile: string, workflow: string) =>
  api.stopWorkflow(profile, workflow).catch(reportError);
