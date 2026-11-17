import { expect, test } from "bun:test";

import { decodeEventBatch } from "@/lib/eventBatch";

const frame = (header: object, payload: number[]) => {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const buffer = new Uint8Array(4 + json.length + payload.length);
  new DataView(buffer.buffer).setUint32(0, json.length, true);
  buffer.set(json, 4);
  buffer.set(payload, 4 + json.length);
  return buffer.buffer;
};

const data = { type: "data", profile: "p", timestamp: "2026-11-17T00:00:00Z", source: "A", target: "B", origin: "received", bytes: [], delivered: true };

test("payloads are sliced in row order and skipped summaries become events", () => {
  const { events, lagged } = decodeEventBatch(frame({
    rows: [{ event: data, length: 2 }, { event: { type: "status", profile: "p", timestamp: data.timestamp, side: "A", state: { state: "listening" } }, length: 0 }, { event: data, length: 1 }],
    skipped: [{ profile: "p", timestamp: data.timestamp, source: "A", target: "B", origin: "received", delivered: true, chunks: 4, length: 400 }],
    lagged: 3,
  }, [1, 2, 3]));
  expect(lagged).toBe(3);
  expect(events.map((event) => event.type)).toEqual(["skipped", "data", "status", "data"]);
  expect(events[1]).toMatchObject({ bytes: Uint8Array.of(1, 2), length: 2 });
  expect(events[3]).toMatchObject({ bytes: Uint8Array.of(3), length: 1 });
});
