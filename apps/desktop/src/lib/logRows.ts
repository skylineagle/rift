import { describeConnectionState } from "@/lib/sideStatus";
import { hexString, printableAscii } from "@/lib/format";
import type { Origin, RiftEvent, SideName } from "@/lib/types";

export type LogDirection = "A" | "B" | "AB" | "BA";
export type LogLevel = "ok" | "warn" | "err";

export type DataRow = {
  id: number;
  type: "data";
  time: number;
  direction: LogDirection;
  origin: Origin;
  bytes: number[];
  delivered: boolean;
  undelivered_reason?: string;
};

export type StatusRow = {
  id: number;
  type: "status";
  time: number;
  side: SideName | null;
  level: LogLevel;
  text: string;
};

export type LogRow = DataRow | StatusRow;

let nextRowId = 0;

export const statusRow = (
  side: SideName | null,
  level: LogLevel,
  text: string,
  time = Date.now(),
): StatusRow => ({ id: ++nextRowId, type: "status", time, side, level, text });

export const rowFromEvent = (event: RiftEvent): LogRow => {
  const time = Date.parse(event.timestamp);
  if (event.type === "status") {
    const level =
      event.state.state === "error"
        ? "err"
        : event.state.state === "disconnected"
          ? "warn"
          : "ok";
    return statusRow(event.side, level, describeConnectionState(event.state), time);
  }
  return {
    id: ++nextRowId,
    type: "data",
    time,
    direction: event.origin === "received" ? event.source : event.source === "A" ? "AB" : "BA",
    origin: event.origin,
    bytes: event.bytes,
    delivered: event.delivered,
    undelivered_reason: event.undelivered_reason,
  };
};

export const dropText = (row: DataRow) =>
  row.undelivered_reason
    ? `Not delivered: Side ${row.direction === "AB" ? "B" : "A"} is ${row.undelivered_reason}`
    : `not delivered to side ${row.direction === "AB" ? "B" : "A"}`;

export type LogFilter = {
  direction: "all" | LogDirection;
  injectedOnly: boolean;
  query: string;
};

export const matchesFilter = (row: LogRow, filter: LogFilter) => {
  const query = filter.query.trim().toLowerCase();
  if (row.type === "status") return !query || row.text.toLowerCase().includes(query);
  if (filter.direction !== "all" && row.direction !== filter.direction) return false;
  if (filter.injectedOnly && row.origin !== "injected") return false;
  if (!query) return true;
  if (!row.delivered && dropText(row).toLowerCase().includes(query)) return true;
  const hex = hexString(row.bytes).toLowerCase();
  return (
    printableAscii(row.bytes).toLowerCase().includes(query) ||
    hex.includes(query) ||
    hex.replaceAll(" ", "").includes(query.replace(/\s/g, ""))
  );
};

export const rowToText = (row: LogRow) => {
  const time = new Date(row.time).toISOString();
  if (row.type === "status") return `${time} ${row.side ?? "-"} ${row.text}`;
  const arrow = row.origin === "received" ? `${row.direction} received` : row.direction === "AB" ? "A->B" : "B->A";
  const origin = row.origin === "injected" ? " injected" : "";
  const dropped = row.delivered ? "" : ` not-delivered${row.undelivered_reason ? ` [${dropText(row)}]` : ""}`;
  return `${time} ${arrow} ${row.bytes.length}B${origin}${dropped} ${hexString(row.bytes)} |${printableAscii(row.bytes)}|`;
};
