import { listen } from "@tauri-apps/api/event";

import type { RiftEvent } from "@/lib/types";

type EventListener = (event: RiftEvent) => void;
type BatchListener = (events: RiftEvent[]) => void;

const eventListeners = new Set<EventListener>();
const batchListeners = new Set<BatchListener>();
let pendingEvents: RiftEvent[] = [];
let scheduledFrame = 0;

const flushBatch = () => {
  scheduledFrame = 0;
  const batch = pendingEvents;
  pendingEvents = [];
  batchListeners.forEach((listener) => listener(batch));
};

const receive = (event: RiftEvent) => {
  eventListeners.forEach((listener) => listener(event));
  pendingEvents.push(event);
  if (!scheduledFrame) scheduledFrame = requestAnimationFrame(flushBatch);
};

listen<RiftEvent>("rift://event", ({ payload }) => receive(payload)).catch(
  () => undefined,
);

export const subscribeToEvents = (listener: EventListener) => {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
};

export const subscribeToBatches = (listener: BatchListener) => {
  batchListeners.add(listener);
  return () => batchListeners.delete(listener);
};
