import type { InjectPreviewResult } from "@/components/InjectPreview";
import { createStore } from "@/lib/createStore";
import { errorMessage } from "@/lib/format";
import * as api from "@/lib/tauriApi";
import type { PayloadFormat, Workflow } from "@/lib/types";

type PreviewState = Record<string, InjectPreviewResult>;

const PENDING: InjectPreviewResult = { bytes: [], error: null };
const CACHE_LIMIT = 200;
const requested = new Set<string>();

export const payloadPreviewStore = createStore<PreviewState>({});

const previewKey = (format: PayloadFormat, payload: string) => `${format}:${payload}`;

export const selectPreview = (state: PreviewState, format: PayloadFormat, payload: string) =>
  state[previewKey(format, payload)] ?? PENDING;

const loadPreview = async (
  format: PayloadFormat,
  payload: string,
): Promise<InjectPreviewResult> => {
  try {
    return { bytes: await api.previewPayload(format, payload), error: null };
  } catch (error) {
    return { bytes: null, error: errorMessage(error) };
  }
};

const storePreview = (state: PreviewState, key: string, result: InjectPreviewResult) => {
  const entries = Object.entries(state).filter(([existing]) => existing !== key);
  const evicted = entries.slice(0, Math.max(0, entries.length - CACHE_LIMIT + 1));
  evicted.forEach(([existing]) => requested.delete(existing));
  return Object.fromEntries([...entries.slice(evicted.length), [key, result]]);
};

export const requestPreview = async (format: PayloadFormat, payload: string) => {
  const key = previewKey(format, payload);
  if (format === "file" || !payload || requested.has(key)) return;
  requested.add(key);
  const result = await loadPreview(format, payload);
  payloadPreviewStore.setState((state) => storePreview(state, key, result));
};

export const requestWorkflowPreviews = ({ steps }: Workflow) =>
  steps.forEach((step) => {
    if (step.action === "send") void requestPreview(step.format, step.payload);
  });
