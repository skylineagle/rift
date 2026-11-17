import type { DataEvent, RiftEvent, SkippedEvent } from "@/lib/types";

type WireEvent = Exclude<RiftEvent, SkippedEvent>;
type WireRow = { event: WireEvent; length: number };
type WireSkipped = Omit<SkippedEvent, "type">;
type BatchHeader = { rows: WireRow[]; skipped: WireSkipped[]; lagged: number };

export type EventBatch = { events: RiftEvent[]; lagged: number };

const decoder = new TextDecoder();

export const decodeEventBatch = (buffer: ArrayBuffer): EventBatch => {
  const headerLength = new DataView(buffer).getUint32(0, true);
  const header: BatchHeader = JSON.parse(decoder.decode(new Uint8Array(buffer, 4, headerLength)));
  let offset = 4 + headerLength;
  const events: RiftEvent[] = header.rows.map(({ event, length }) => {
    if (event.type !== "data") return event;
    const bytes = new Uint8Array(buffer.slice(offset, offset + length));
    offset += length;
    return { ...event, bytes, length } satisfies DataEvent;
  });
  const skipped = header.skipped.map((entry): SkippedEvent => ({ type: "skipped", ...entry }));
  return { events: [...skipped, ...events], lagged: header.lagged };
};
