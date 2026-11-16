import { createStore } from "@/lib/createStore";
import type { PayloadFormat, Target } from "@/lib/types";

export type InjectHistoryEntry = {
  target: Target;
  format: PayloadFormat;
  value: string;
};

const STORAGE_KEY = "rift-inject-history";
const MAX_ENTRIES = 8;
const NO_ENTRIES: InjectHistoryEntry[] = [];

type HistoryState = Record<string, InjectHistoryEntry[]>;

const readStored = (): HistoryState => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as HistoryState;
  } catch {
    return {};
  }
};

export const injectHistoryStore = createStore<HistoryState>(readStored());

export const selectHistory = (state: HistoryState, name: string) =>
  state[name] ?? NO_ENTRIES;

export const rememberInjection = (name: string, entry: InjectHistoryEntry) => {
  injectHistoryStore.setState((state) => {
    const others = selectHistory(state, name).filter(
      (candidate) =>
        candidate.target !== entry.target ||
        candidate.format !== entry.format ||
        candidate.value !== entry.value,
    );
    return { ...state, [name]: [entry, ...others].slice(0, MAX_ENTRIES) };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(injectHistoryStore.getState()));
  } catch {
    return;
  }
};
