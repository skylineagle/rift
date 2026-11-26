import { toast } from "@yusufceng1z/ding-react";

import type { Workflow } from "@/lib/types";
import { insertAt, uniqueWorkflowName, upsertWorkflow, workflowNames } from "@/lib/workflows";
import { profilesStore, saveWorkflows } from "@/stores/profilesStore";
import { selectRunning, stopWorkflow, workflowRunStore } from "@/stores/workflowRunStore";

const storedWorkflows = (profile: string) =>
  profilesStore.getState().profiles.find(({ name }) => name === profile)?.workflows ?? [];

export const addWorkflow = (profile: string, workflow: Workflow) =>
  saveWorkflows(profile, upsertWorkflow(storedWorkflows(profile), null, workflow));

export const duplicateWorkflow = (profile: string, workflow: Workflow) => {
  const workflows = storedWorkflows(profile);
  const index = workflows.findIndex(({ name }) => name === workflow.name);
  const name = uniqueWorkflowName(`${workflow.name} copy`, workflowNames(workflows));
  return saveWorkflows(
    profile,
    insertAt(workflows, index + 1, { ...workflow, name, autostart: false }),
  );
};

const restoreWorkflow = (profile: string, workflow: Workflow, index: number) => {
  const workflows = storedWorkflows(profile);
  const name = uniqueWorkflowName(workflow.name, workflowNames(workflows));
  return saveWorkflows(profile, insertAt(workflows, index, { ...workflow, name }));
};

export const deleteWorkflow = async (profile: string, workflow: Workflow) => {
  if (selectRunning(workflowRunStore.getState(), profile).includes(workflow.name)) {
    await stopWorkflow(profile, workflow.name);
  }
  const workflows = storedWorkflows(profile);
  const index = workflows.findIndex(({ name }) => name === workflow.name);
  const remaining = workflows.filter(({ name }) => name !== workflow.name);
  if (!(await saveWorkflows(profile, remaining))) return;
  toast.info(`Deleted “${workflow.name}”`, {
    duration: 5000,
    action: {
      label: "Undo",
      onClick: () => {
        void restoreWorkflow(profile, workflow, index);
        return { title: "Restored", action: null };
      },
    },
  });
};
