import { ArrowLeft, Plus } from "lucide-react";
import { useState, type FC } from "react";

import { RepeatFields } from "@/components/RepeatFields";
import { TooltipButton } from "@/components/TooltipButton";
import { WorkflowLockedNotice } from "@/components/WorkflowLockedNotice";
import { WorkflowStepCard } from "@/components/WorkflowStepCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/hooks/useStore";
import { errorMessage } from "@/lib/format";
import * as api from "@/lib/tauriApi";
import type { Profile } from "@/lib/types";
import {
  appendStep,
  defaultSendStep,
  defaultWaitStep,
  fromDraft,
  moveItem,
  nameError,
  removeAt,
  replaceStep,
  toDraft,
  upsertWorkflow,
  workflowNames,
  type StepDraft,
  type WorkflowDraft,
} from "@/lib/workflows";
import { saveWorkflows } from "@/stores/profilesStore";
import { closeEditor, type EditorSession } from "@/stores/workflowPanelStore";
import { selectProgress, stopWorkflow, workflowRunStore } from "@/stores/workflowRunStore";

export type WorkflowEditorProps = { profile: Profile; session: EditorSession };

export const WorkflowEditor: FC<WorkflowEditorProps> = ({ profile, session }) => {
  const { previousName } = session;
  const [draft, setDraft] = useState(() => toDraft(session.workflow));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const progress = useStore(workflowRunStore, (state) =>
    previousName === null ? undefined : selectProgress(state, profile.name, previousName),
  );
  const locked = !!progress;

  const change = (changes: Partial<WorkflowDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError(null);
  };

  const add = (step: StepDraft) => change({ steps: appendStep(draft.steps, step) });

  const save = async () => {
    const workflows = profile.workflows ?? [];
    const taken = workflowNames(workflows).filter((name) => name !== previousName);
    const invalidName = nameError(draft.name, taken);
    if (invalidName) return setError(invalidName);
    const workflow = fromDraft(draft);
    setSaving(true);
    try {
      await api.validateWorkflow(workflow);
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
      return;
    }
    const saved = await saveWorkflows(
      profile.name,
      upsertWorkflow(workflows, previousName, workflow),
    );
    setSaving(false);
    if (saved) closeEditor();
    else setError("Could not save the workflow");
  };

  return (
    <form
      aria-label="Edit workflow"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked && !saving) void save();
      }}
    >
      <header className="flex h-10 flex-none items-center gap-1.5 px-2">
        <TooltipButton
          type="button"
          variant="ghost"
          size="icon"
          tip="Back to workflows"
          onClick={closeEditor}
        >
          <ArrowLeft />
        </TooltipButton>
        <Input
          aria-label="Workflow name"
          className="border-transparent bg-transparent text-[13px] font-[650] hover:border-line-2"
          value={draft.name}
          disabled={locked}
          onChange={(event) => change({ name: event.target.value })}
        />
      </header>
      {previousName !== null && locked && (
        <WorkflowLockedNotice onStop={() => void stopWorkflow(profile.name, previousName)} />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3">
        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <RepeatFields
            repetition={draft.repetition}
            onChange={(repetition) => change({ repetition })}
          />
          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-xs font-medium">Autostart</span>
              <span className="text-[11.5px] text-fg-3">Run when the bridge starts</span>
            </span>
            <Switch
              checked={draft.autostart}
              onCheckedChange={(autostart) => change({ autostart })}
            />
          </label>
        </fieldset>
        <h3 className="mt-4 mb-1.5 text-[10.5px] font-semibold tracking-[0.02em] text-fg-3">
          Steps
        </h3>
        <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {draft.steps.map((step, index) => (
              <WorkflowStepCard
                key={step.id}
                step={step}
                index={index}
                count={draft.steps.length}
                active={progress?.step === index}
                locked={locked}
                onChange={(next) => change({ steps: replaceStep(draft.steps, next) })}
                onMove={(offset) => change({ steps: moveItem(draft.steps, index, offset) })}
                onRemove={() => change({ steps: removeAt(draft.steps, index) })}
              />
            ))}
          </ol>
          <div className="mt-2 flex gap-1.5 pl-6">
            <Button type="button" variant="secondary" size="sm" onClick={() => add(defaultSendStep())}>
              <Plus />
              Send
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => add(defaultWaitStep())}>
              <Plus />
              Wait
            </Button>
          </div>
        </fieldset>
      </div>
      <footer className="flex flex-none flex-col gap-2 border-t border-line px-3 py-2">
        {error && (
          <p role="alert" className="m-0 text-[11.5px] leading-snug text-err">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" onClick={closeEditor}>
            Cancel
          </Button>
          <Button type="submit" disabled={locked || saving}>
            Save
          </Button>
        </div>
      </footer>
    </form>
  );
};
