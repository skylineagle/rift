import { createStore } from "@/lib/createStore";
import { rowFromEvent, type LogRow } from "@/lib/logRows";
import type { RiftEvent } from "@/lib/types";
import { subscribeToBatches } from "@/stores/eventStream";

const MAX_ROWS = 5000;
const NO_ROWS: LogRow[] = [];

type LogState = { rows: Record<string, LogRow[]> };

export const logStore = createStore<LogState>({ rows: {} });

export const selectRows = (state: LogState, name: string) =>
  state.rows[name] ?? NO_ROWS;

const appendRows = (additions: Record<string, LogRow[]>) =>
  logStore.setState((state) => {
    const rows = { ...state.rows };
    Object.entries(additions).forEach(([name, added]) => {
      rows[name] = [...selectRows(state, name), ...added].slice(-MAX_ROWS);
    });
    return { rows };
  });

subscribeToBatches((events: RiftEvent[]) => {
  const additions: Record<string, LogRow[]> = {};
  events.forEach((event) => {
    (additions[event.profile] ??= []).push(rowFromEvent(event));
  });
  appendRows(additions);
});

export const appendLocalRow = (name: string, row: LogRow) =>
  appendRows({ [name]: [row] });

export const clearRows = (name: string) =>
  logStore.setState((state) => ({ rows: { ...state.rows, [name]: NO_ROWS } }));
