import type { WorkflowEvent, WorkflowStatus } from "@/lib/types";

export type WorkflowProgress = { cycle: number; step: number };
export type WorkflowRuns = Record<string, WorkflowStatus>;

export const workflowRunKey = (profile: string, workflow: string) =>
  JSON.stringify([profile, workflow]);

const INITIAL_PROGRESS: WorkflowProgress = { cycle: 1, step: 0 };

export const applyWorkflowEvent = (runs: WorkflowRuns, event: WorkflowEvent): WorkflowRuns => {
  const { profile, workflow, state } = event;
  const key = workflowRunKey(profile, workflow);
  if (state.state === "started" || state.state === "step") {
    const { cycle, step } = state.state === "step" ? state : INITIAL_PROGRESS;
    return { ...runs, [key]: { profile, workflow, cycle, step } };
  }
  if (!(key in runs)) return runs;
  const { [key]: _ended, ...remaining } = runs;
  return remaining;
};

export const reconcileWorkflowRuns = (
  statuses: WorkflowStatus[],
  arrived: WorkflowEvent[],
  fetchStartedAt: number,
): WorkflowRuns =>
  arrived
    .filter((event) => Date.parse(event.timestamp) >= fetchStartedAt)
    .reduce<WorkflowRuns>(
      applyWorkflowEvent,
      Object.fromEntries(
        statuses.map((status) => [workflowRunKey(status.profile, status.workflow), status]),
      ),
    );

export const runningWorkflowNames = (runs: WorkflowRuns, profile: string) =>
  Object.values(runs)
    .filter((run) => run.profile === profile)
    .map((run) => run.workflow);
