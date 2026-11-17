import { Channel, invoke } from "@tauri-apps/api/core";

import { decodeEventBatch } from "@/lib/eventBatch";
import type { RiftEvent } from "@/lib/types";

type EventListener = (event: RiftEvent) => void;
type BatchListener = (events: RiftEvent[], lagged: number) => void;

const eventListeners = new Set<EventListener>();
const batchListeners = new Set<BatchListener>();

const receive = (buffer: ArrayBuffer) => {
  const { events, lagged } = decodeEventBatch(buffer);
  events.forEach((event) => eventListeners.forEach((listener) => listener(event)));
  batchListeners.forEach((listener) => listener(events, lagged));
};

const connect = () => invoke("subscribe_events", { channel: new Channel<ArrayBuffer>(receive) });

Promise.resolve().then(connect).catch(() => undefined);

export const subscribeToEvents = (listener: EventListener) => {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
};

export const subscribeToBatches = (listener: BatchListener) => {
  batchListeners.add(listener);
  return () => batchListeners.delete(listener);
};
