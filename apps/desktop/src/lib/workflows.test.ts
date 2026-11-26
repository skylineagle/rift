import { expect, test } from "bun:test";

import type { Workflow } from "@/lib/types";
import {
  appendStep,
  changeUnit,
  defaultWaitStep,
  fromDraft,
  fromMillis,
  insertAt,
  moveItem,
  nameError,
  progressFraction,
  progressLabel,
  quickRepeatWorkflow,
  removeAt,
  toDraft,
  toMillis,
  uniqueWorkflowName,
  upsertWorkflow,
  workflowSummary,
} from "@/lib/workflows";

const heartbeat: Workflow = {
  name: "heartbeat",
  autostart: true,
  repeat: 10,
  steps: [
    { action: "send", target: "B", format: "text", payload: "PING" },
    { action: "wait", millis: 2000 },
  ],
};

test("converts between milliseconds and seconds", () => {
  expect(toMillis({ amount: 1.5, unit: "s" })).toBe(1500);
  expect(toMillis({ amount: null, unit: "s" })).toBe(0);
  expect(fromMillis(1500)).toEqual({ amount: 1.5, unit: "s" });
  expect(fromMillis(250)).toEqual({ amount: 250, unit: "ms" });
  expect(fromMillis(1234)).toEqual({ amount: 1234, unit: "ms" });
  expect(changeUnit({ amount: 2, unit: "s" }, "ms")).toEqual({ amount: 2000, unit: "ms" });
});

test("summarizes a repeated send and longer workflows", () => {
  expect(workflowSummary(heartbeat)).toBe("Send B · text · every 2 s · ×10");
  const { repeat: _, ...forever } = heartbeat;
  expect(workflowSummary({ ...forever, steps: [...heartbeat.steps, ...heartbeat.steps] })).toBe(
    "4 steps · forever",
  );
});

test("builds a quick repeat with a unique name and no repeat when forever", () => {
  const workflow = quickRepeatWorkflow(
    {
      target: "Both",
      format: "hex",
      payload: "01",
      every: { amount: 500, unit: "ms" },
      repetition: { mode: "forever", count: 3 },
    },
    ["Repeat A+B"],
  );
  expect(workflow.name).toBe("Repeat A+B 2");
  expect("repeat" in workflow).toBe(false);
  expect(workflow.steps[1]).toEqual({ action: "wait", millis: 500 });
});

test("round trips a workflow through its draft", () => {
  expect(fromDraft(toDraft(heartbeat))).toEqual(heartbeat);
});

test("keys appended steps uniquely", () => {
  const { steps } = toDraft(heartbeat);
  expect(appendStep(removeAt(steps, 0), defaultWaitStep()).map(({ id }) => id)).toEqual([1, 2]);
});

test("moves, inserts and removes items", () => {
  expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
  expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  expect(insertAt([1, 3], 1, 2)).toEqual([1, 2, 3]);
  expect(removeAt([1, 2, 3], 1)).toEqual([1, 3]);
});

test("keeps names unique", () => {
  expect(uniqueWorkflowName("a", ["a", "a 2"])).toBe("a 3");
  expect(nameError(" ", [])).not.toBeNull();
  expect(nameError(" a ", ["a"])).not.toBeNull();
  expect(nameError("b", ["a"])).toBeNull();
});

test("replaces by previous name or appends", () => {
  const renamed = { ...heartbeat, name: "pulse" };
  expect(upsertWorkflow([heartbeat], "heartbeat", renamed)).toEqual([renamed]);
  expect(upsertWorkflow([heartbeat], null, renamed)).toEqual([heartbeat, renamed]);
});

test("describes run progress", () => {
  expect(progressLabel({ cycle: 3, step: 1 }, 10)).toBe("cycle 3/10 · step 2");
  expect(progressLabel({ cycle: 3, step: 1 }, undefined)).toBe("cycle 3 · step 2");
  expect(progressFraction({ cycle: 6, step: 1 }, heartbeat)).toBe(0.6);
});
