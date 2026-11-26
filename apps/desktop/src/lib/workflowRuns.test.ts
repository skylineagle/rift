import { expect, test } from "bun:test";

import type { WorkflowEvent, WorkflowState } from "@/lib/types";
import {
  applyWorkflowEvent,
  reconcileWorkflowRuns,
  runningWorkflowNames,
  workflowRunKey,
} from "@/lib/workflowRuns";

const event = (state: WorkflowState, workflow = "heartbeat"): WorkflowEvent => ({
  type: "workflow",
  profile: "gps",
  timestamp: "",
  workflow,
  state,
});

test("started and step set progress", () => {
  const started = applyWorkflowEvent({}, event({ state: "started" }));
  expect(started[workflowRunKey("gps", "heartbeat")]).toMatchObject({ cycle: 1, step: 0 });
  const stepped = applyWorkflowEvent(started, event({ state: "step", cycle: 3, step: 2 }));
  expect(stepped[workflowRunKey("gps", "heartbeat")]).toMatchObject({ cycle: 3, step: 2 });
});

test("every ending removes the run and unknown runs keep the same reference", () => {
  const endings: WorkflowState[] = [
    { state: "finished" },
    { state: "stopped" },
    { state: "failed", message: "boom" },
  ];
  for (const ending of endings) {
    const runs = applyWorkflowEvent({}, event({ state: "started" }));
    expect(applyWorkflowEvent(runs, event(ending))).toEqual({});
  }
  const empty = {};
  expect(applyWorkflowEvent(empty, event({ state: "stopped" }))).toBe(empty);
});

test("keys never collide across profile and workflow names", () => {
  expect(workflowRunKey("a:b", "c")).not.toBe(workflowRunKey("a", "b:c"));
});

test("reconciling replaces stale runs and replays only events since the fetch began", () => {
  const status = { profile: "gps", cycle: 2, step: 1 };
  const at = (milliseconds: number, state: WorkflowState, workflow: string) => ({
    ...event(state, workflow),
    timestamp: new Date(milliseconds).toISOString(),
  });
  const runs = reconcileWorkflowRuns(
    [{ ...status, workflow: "ending" }, { ...status, workflow: "quiet" }],
    [
      at(900, { state: "stopped" }, "quiet"),
      at(1100, { state: "finished" }, "ending"),
      at(1200, { state: "started" }, "fresh"),
    ],
    1000,
  );
  expect(runningWorkflowNames(runs, "gps")).toEqual(["quiet", "fresh"]);
  expect(runningWorkflowNames(runs, "g")).toEqual([]);
});
