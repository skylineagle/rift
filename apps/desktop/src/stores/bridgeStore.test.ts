import { afterAll, expect, mock, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { DataEvent, RiftEvent } from "@/lib/types";

let receive: (events: RiftEvent[]) => void = () => undefined;
mock.module("@/lib/tauriApi", () => ({ bridgeStatus: async () => [] }));
mock.module("@/stores/eventStream", () => ({
  subscribeToBatches: (listener: (events: RiftEvent[]) => void) => {
    receive = listener;
    return () => undefined;
  },
}));
let now = 0;
let scheduled: (() => void) | undefined;
let deadline = 0;
const clock = spyOn(performance, "now").mockImplementation(() => now);
const timer = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
  scheduled = callback;
  deadline = now + delay;
  return 1;
}) as typeof setTimeout);
const cancel = spyOn(globalThis, "clearTimeout").mockImplementation(() => { scheduled = undefined; });
const { bridgeStore, markRunning, markStopped, pauseSide } = await import("@/stores/bridgeStore");
afterAll(() => {
  markStopped("test");
  clock.mockRestore();
  timer.mockRestore();
  cancel.mockRestore();
});
const advance = (target: number) => {
  while (scheduled && deadline <= target) {
    now = deadline;
    const callback = scheduled;
    scheduled = undefined;
    callback();
  }
  now = target;
};
const data = (source: "A" | "B", origin: "received" | "forwarded", size: number): DataEvent => ({
  type: "data", profile: "test", timestamp: "", source,
  target: source === "A" ? "B" : "A", origin, bytes: Array<number>(size).fill(1), delivered: true,
});
test("rates expire independently without further events and counters count each event once", () => {
  markRunning("test");
  receive([data("A", "received", 10), data("A", "forwarded", 10)]);
  advance(250);
  expect(bridgeStore.getState().bridges.test.rates).toEqual({ ab: 10, ba: 0 });
  advance(2000);
  receive([data("B", "received", 20), data("B", "forwarded", 20)]);
  advance(2250);
  expect(bridgeStore.getState().bridges.test.rates).toEqual({ ab: 10, ba: 20 });
  advance(4999);
  expect(bridgeStore.getState().bridges.test.rates).toEqual({ ab: 10, ba: 20 });
  advance(5000);
  expect(bridgeStore.getState().bridges.test.rates).toEqual({ ab: 0, ba: 20 });
  advance(7000);
  expect(bridgeStore.getState().bridges.test.rates).toEqual({ ab: 0, ba: 0 });
  expect(bridgeStore.getState().bridges.test.counters).toEqual({
    A: { received: 10, sent: 20 }, B: { received: 20, sent: 10 },
  });
  expect(scheduled).toBeUndefined();
});
test("the app configures the toaster at the top center", () => {
  expect(readFileSync(new URL("../components/App.tsx", import.meta.url), "utf8"))
    .toMatch(/<Toaster\s+position="top-center"/);
});

test("side rates count receives separately from successful sends and reset only the paused side", () => {
  markStopped("test");
  markRunning("test");
  receive([
    data("A", "received", 11),
    data("B", "received", 7),
    data("A", "forwarded", 5),
    { ...data("B", "forwarded", 3), origin: "injected" },
    { ...data("A", "forwarded", 99), delivered: false },
  ]);
  advance(now + 250);
  let bridge = bridgeStore.getState().bridges.test;
  expect(bridge.counters).toEqual({ A: { received: 11, sent: 3 }, B: { received: 7, sent: 5 } });
  expect(bridge.sideRates).toEqual({ A: { received: 11, sent: 3 }, B: { received: 7, sent: 5 } });
  pauseSide("test", "A");
  receive([data("A", "received", 50), data("B", "received", 2)]);
  bridge = bridgeStore.getState().bridges.test;
  expect(bridge.counters).toEqual({ A: { received: 0, sent: 0 }, B: { received: 9, sent: 5 } });
  expect(bridge.sideRates.A).toEqual({ received: 0, sent: 0 });
  advance(now + 5000);
  bridge = bridgeStore.getState().bridges.test;
  expect(bridge.sideRates).toEqual({ A: { received: 0, sent: 0 }, B: { received: 0, sent: 0 } });
  expect(bridge.counters.B).toEqual({ received: 9, sent: 5 });
});
