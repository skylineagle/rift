import { expect, test } from "bun:test";

import type { WorkflowEvent, WorkflowState } from "@/lib/types";
import { applyWorkflowEvent, runningWorkflowNames, seedWorkflowRuns } from "@/lib/workflowRuns";

const event = (state: WorkflowState, workflow = "heartbeat"): WorkflowEvent => ({
  type: "workflow",
  profile: "gps",
  timestamp: "",
  workflow,
  state,
});

test("started and step set progress", () => {
  const started = applyWorkflowEvent({}, event({ state: "started" }));
  expect(started["gps:heartbeat"]).toMatchObject({ cycle: 1, step: 0 });
  const stepped = applyWorkflowEvent(started, event({ state: "step", cycle: 3, step: 2 }));
  expect(stepped["gps:heartbeat"]).toMatchObject({ cycle: 3, step: 2 });
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

test("seeding never overrides what events already reported", () => {
  const status = { profile: "gps", cycle: 2, step: 1 };
  const runs = seedWorkflowRuns(
    {},
    [{ ...status, workflow: "ended" }, { ...status, workflow: "quiet" }],
    new Set(["gps:ended"]),
  );
  expect(runningWorkflowNames(runs, "gps")).toEqual(["quiet"]);
  expect(runningWorkflowNames(runs, "g")).toEqual([]);
});
