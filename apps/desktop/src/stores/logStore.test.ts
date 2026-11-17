import { mock, expect, test } from "bun:test";

mock.module("@/stores/eventStream", () => ({ subscribeToBatches: () => () => undefined }));

const { MAX_PAYLOAD_BYTES, MAX_ROWS, newestWithinLimits } = await import("@/stores/logStore");
const { statusRow } = await import("@/lib/logRows");

const dataRow = (id: number, size: number) => ({
  id, type: "data" as const, time: 0, direction: "A" as const, origin: "received" as const,
  bytes: new Uint8Array(size), delivered: true,
});

test("rotation keeps the newest rows up to the row cap", () => {
  const rows = Array.from({ length: MAX_ROWS + 5 }, (_, index) => statusRow(null, "ok", String(index)));
  const kept = newestWithinLimits(rows);
  expect(kept.length).toBe(MAX_ROWS);
  expect(kept.at(-1)).toBe(rows.at(-1)!);
});

test("rotation keeps the newest rows up to the payload cap but always the latest row", () => {
  const half = MAX_PAYLOAD_BYTES / 2;
  expect(newestWithinLimits([dataRow(1, half), dataRow(2, half), dataRow(3, half)]).map((row) => row.id)).toEqual([2, 3]);
  expect(newestWithinLimits([dataRow(1, 10), dataRow(2, MAX_PAYLOAD_BYTES * 2)]).map((row) => row.id)).toEqual([2]);
});
