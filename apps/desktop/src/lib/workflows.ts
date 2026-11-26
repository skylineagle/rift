import { TARGET_LABELS } from "@/lib/injection";
import type { WorkflowProgress } from "@/lib/workflowRuns";
import type { PayloadFormat, Target, Workflow, WorkflowStep } from "@/lib/types";

export type DurationUnit = "ms" | "s";
export type Duration = { amount: number | null; unit: DurationUnit };
export type RepeatMode = "forever" | "count";
export type Repetition = { mode: RepeatMode; count: number | null };

export type SendStep = Extract<WorkflowStep, { action: "send" }>;
export type WaitDraft = { action: "wait" } & Duration;
export type StepDraft = SendStep | WaitDraft;
export type KeyedStep = StepDraft & { id: number };

export type WorkflowDraft = {
  name: string;
  autostart: boolean;
  repetition: Repetition;
  steps: KeyedStep[];
};

export type QuickRepeat = {
  target: Target;
  format: PayloadFormat;
  payload: string;
  every: Duration;
  repetition: Repetition;
};

export const DURATION_UNIT_OPTIONS = [
  { value: "ms", label: "ms" },
  { value: "s", label: "s" },
];

const MILLIS_PER_SECOND = 1000;
const DEFAULT_COUNT = 10;

export const toMillis = ({ amount, unit }: Duration) =>
  Math.max(0, Math.round((amount ?? 0) * (unit === "s" ? MILLIS_PER_SECOND : 1)));

export const fromMillis = (millis: number): Duration =>
  millis >= MILLIS_PER_SECOND && millis % 100 === 0
    ? { amount: millis / MILLIS_PER_SECOND, unit: "s" }
    : { amount: millis, unit: "ms" };

export const changeUnit = (duration: Duration, unit: DurationUnit): Duration => {
  if (duration.amount === null) return { amount: null, unit };
  const millis = toMillis(duration);
  return { amount: unit === "s" ? millis / MILLIS_PER_SECOND : millis, unit };
};

export const defaultSendStep = (): SendStep => ({
  action: "send",
  target: "B",
  format: "text",
  payload: "",
});

export const defaultWaitStep = (): WaitDraft => ({ action: "wait", amount: 1, unit: "s" });

export const uniqueWorkflowName = (base: string, names: string[]) => {
  if (!names.includes(base)) return base;
  let counter = 2;
  while (names.includes(`${base} ${counter}`)) counter += 1;
  return `${base} ${counter}`;
};

export const workflowNames = (workflows: Workflow[]) => workflows.map(({ name }) => name);

export const nameError = (name: string, takenNames: string[]) => {
  if (!name.trim()) return "Name cannot be empty";
  return takenNames.includes(name.trim()) ? "A workflow with that name already exists" : null;
};

const repeatOf = ({ mode, count }: Repetition) =>
  mode === "forever" ? undefined : Math.max(1, Math.round(count ?? 1));

const withRepeat = (workflow: Workflow, repeat: number | undefined): Workflow =>
  repeat === undefined ? workflow : { ...workflow, repeat };

export const repetitionOf = (workflow: Workflow): Repetition =>
  workflow.repeat === undefined || workflow.repeat === null
    ? { mode: "forever", count: DEFAULT_COUNT }
    : { mode: "count", count: workflow.repeat };

export const blankWorkflow = (names: string[]): Workflow => ({
  name: uniqueWorkflowName("Workflow", names),
  autostart: false,
  steps: [defaultSendStep(), { action: "wait", millis: MILLIS_PER_SECOND }],
});

export const workflowFromInjection = (
  injection: { target: Target; format: PayloadFormat; value: string },
  names: string[],
): Workflow => ({
  ...blankWorkflow(names),
  steps: [
    {
      action: "send",
      target: injection.target,
      format: injection.format,
      payload: injection.value,
    },
    { action: "wait", millis: MILLIS_PER_SECOND },
  ],
});

export const quickRepeatWorkflow = (repeat: QuickRepeat, names: string[]): Workflow =>
  withRepeat(
    {
      name: uniqueWorkflowName(`Repeat ${TARGET_LABELS[repeat.target]}`, names),
      autostart: false,
      steps: [
        {
          action: "send",
          target: repeat.target,
          format: repeat.format,
          payload: repeat.payload,
        },
        { action: "wait", millis: toMillis(repeat.every) },
      ],
    },
    repeatOf(repeat.repetition),
  );

const toStepDraft = (step: WorkflowStep): StepDraft =>
  step.action === "send" ? step : { action: "wait", ...fromMillis(step.millis) };

export const toDraft = (workflow: Workflow): WorkflowDraft => ({
  name: workflow.name,
  autostart: workflow.autostart,
  repetition: repetitionOf(workflow),
  steps: workflow.steps.map((step, id) => ({ ...toStepDraft(step), id })),
});

const fromKeyedStep = (step: KeyedStep): WorkflowStep =>
  step.action === "send"
    ? { action: "send", target: step.target, format: step.format, payload: step.payload }
    : { action: "wait", millis: toMillis(step) };

export const fromDraft = (draft: WorkflowDraft): Workflow =>
  withRepeat(
    {
      name: draft.name.trim(),
      autostart: draft.autostart,
      steps: draft.steps.map(fromKeyedStep),
    },
    repeatOf(draft.repetition),
  );

export const appendStep = (steps: KeyedStep[], step: StepDraft): KeyedStep[] => [
  ...steps,
  { ...step, id: Math.max(-1, ...steps.map(({ id }) => id)) + 1 },
];

export const replaceStep = (steps: KeyedStep[], next: KeyedStep) =>
  steps.map((step) => (step.id === next.id ? next : step));

export const insertAt = <Item>(items: Item[], index: number, item: Item) => [
  ...items.slice(0, index),
  item,
  ...items.slice(index),
];

export const removeAt = <Item>(items: Item[], index: number) =>
  items.filter((_, position) => position !== index);

export const moveItem = <Item>(items: Item[], index: number, offset: number) => {
  const destination = index + offset;
  if (destination < 0 || destination >= items.length) return items;
  return insertAt(removeAt(items, index), destination, items[index]);
};

export const upsertWorkflow = (
  workflows: Workflow[],
  previousName: string | null,
  workflow: Workflow,
) =>
  workflows.some(({ name }) => name === previousName)
    ? workflows.map((candidate) => (candidate.name === previousName ? workflow : candidate))
    : [...workflows, workflow];

export const formatDuration = (millis: number) => {
  const { amount, unit } = fromMillis(millis);
  return `${amount} ${unit}`;
};

const repeatSummary = (repeat: number | undefined) =>
  repeat === undefined || repeat === null ? "forever" : `×${repeat}`;

export const workflowSummary = ({ steps, repeat }: Workflow) => {
  const [first, second] = steps;
  if (steps.length === 2 && first.action === "send" && second.action === "wait") {
    return [
      `Send ${TARGET_LABELS[first.target]}`,
      first.format,
      `every ${formatDuration(second.millis)}`,
      repeatSummary(repeat),
    ].join(" · ");
  }
  const count = `${steps.length} ${steps.length === 1 ? "step" : "steps"}`;
  return `${count} · ${repeatSummary(repeat)}`;
};

export const progressLabel = ({ cycle, step }: WorkflowProgress, repeat: number | undefined) => {
  const total = repeat === undefined || repeat === null ? "" : `/${repeat}`;
  return `cycle ${Math.max(1, cycle)}${total} · step ${step + 1}`;
};

export const progressFraction = (
  { cycle, step }: WorkflowProgress,
  { steps, repeat }: Workflow,
) => {
  const stepsDone = step + 1;
  const fraction = repeat
    ? ((Math.max(1, cycle) - 1) * steps.length + stepsDone) / (repeat * steps.length)
    : stepsDone / steps.length;
  return Math.min(1, Math.max(0, fraction));
};
