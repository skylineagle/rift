import { useState, type FC, type FormEvent } from "react";

import { DurationFields } from "@/components/DurationFields";
import { Hint } from "@/components/Hint";
import { RepeatFields } from "@/components/RepeatFields";
import { SendStepFields } from "@/components/SendStepFields";
import { Button } from "@/components/ui/button";
import { useIsRunning } from "@/hooks/useBridge";
import { errorMessage } from "@/lib/format";
import * as api from "@/lib/tauriApi";
import type { Profile } from "@/lib/types";
import { addWorkflow } from "@/lib/workflowActions";
import { defaultSendStep, quickRepeatWorkflow, workflowNames, type QuickRepeat } from "@/lib/workflows";
import { startWorkflow } from "@/stores/workflowRunStore";

export type QuickRepeatFormProps = {
  profile: Profile;
  onCreated?: () => void;
  onCancel?: () => void;
};

export const QuickRepeatForm: FC<QuickRepeatFormProps> = ({ profile, onCreated, onCancel }) => {
  const running = useIsRunning(profile.name);
  const [send, setSend] = useState(defaultSendStep);
  const [every, setEvery] = useState<QuickRepeat["every"]>({ amount: 1, unit: "s" });
  const [repetition, setRepetition] = useState<QuickRepeat["repetition"]>({
    mode: "forever",
    count: 10,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const incomplete = saving || !send.payload;

  const create = async (run: boolean) => {
    const workflow = quickRepeatWorkflow(
      { ...send, every, repetition },
      workflowNames(profile.workflows ?? []),
    );
    setSaving(true);
    setError(null);
    try {
      await api.validateWorkflow(workflow);
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
      return;
    }
    const saved = await addWorkflow(profile.name, workflow);
    setSaving(false);
    if (!saved) return;
    onCreated?.();
    if (run) await startWorkflow(profile.name, workflow.name);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!incomplete) void create(running);
  };

  return (
    <form aria-label="Repeat a send" onSubmit={submit} className="flex flex-col gap-2.5">
      <b className="text-xs font-semibold">Repeat a send</b>
      <SendStepFields step={send} onChange={setSend} />
      <DurationFields label="Every" duration={every} onChange={setEvery} />
      <RepeatFields repetition={repetition} onChange={setRepetition} />
      {error && (
        <p role="alert" className="m-0 text-[11.5px] text-err">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-1.5">
        {onCancel && (
          <Button type="button" variant="ghost" className="mr-auto" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={incomplete}
          onClick={() => void create(false)}
        >
          Create
        </Button>
        {running ? (
          <Button type="button" disabled={incomplete} onClick={() => void create(true)}>
            Create & run
          </Button>
        ) : (
          <Hint text="Start the bridge first">
            <span tabIndex={0}>
              <Button type="button" disabled>
                Create & run
              </Button>
            </span>
          </Hint>
        )}
      </div>
    </form>
  );
};
