import { createStore } from "@/lib/createStore";
import { rowFromEvent, statusRow, type LogRow } from "@/lib/logRows";
import { formatInteger } from "@/lib/format";
import { subscribeToBatches } from "@/stores/eventStream";

export const MAX_ROWS = 10_000;
export const MAX_PAYLOAD_BYTES = 32 * 1024 * 1024;
const NO_ROWS: LogRow[] = [];

type LogState = { rows: Record<string, LogRow[]> };

export const logStore = createStore<LogState>({ rows: {} });

export const selectRows = (state: LogState, name: string) =>
  state.rows[name] ?? NO_ROWS;

const rowBytes = (row: LogRow) => (row.type === "data" ? row.bytes.length : 0);

export const newestWithinLimits = (rows: LogRow[]) => {
  let kept = 0;
  let bytes = 0;
  for (let index = rows.length - 1; index >= 0; index--) {
    bytes += rowBytes(rows[index]);
    if (kept === MAX_ROWS || (kept > 0 && bytes > MAX_PAYLOAD_BYTES)) break;
    kept++;
  }
  return kept === rows.length ? rows : rows.slice(rows.length - kept);
};

const appendRows = (additions: Record<string, LogRow[]>) =>
  logStore.setState((state) => {
    const rows = { ...state.rows };
    Object.entries(additions).forEach(([name, added]) => {
      rows[name] = newestWithinLimits([...selectRows(state, name), ...added]);
    });
    return { rows };
  });

const laggedText = (lagged: number) =>
  `${formatInteger(lagged)} events not shown, the log fell behind`;

subscribeToBatches((events, lagged) => {
  const additions: Record<string, LogRow[]> = {};
  if (lagged > 0) {
    Object.keys(logStore.getState().rows).forEach((name) => {
      additions[name] = [statusRow(null, "warn", laggedText(lagged))];
    });
  }
  events.forEach((event) => {
    if (event.type === "workflow") return;
    (additions[event.profile] ??= []).push(rowFromEvent(event));
  });
  appendRows(additions);
});

export const appendLocalRow = (name: string, row: LogRow) =>
  appendRows({ [name]: [row] });

export const clearRows = (name: string) =>
  logStore.setState((state) => ({ rows: { ...state.rows, [name]: NO_ROWS } }));
