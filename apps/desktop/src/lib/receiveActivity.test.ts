import { expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import type { RiftEvent } from "@/lib/types";

mock.module("@tauri-apps/api/core", () => ({ invoke: async () => undefined, Channel: class {} }));
const { attachReceiveActivity } = await import("@/lib/receiveActivity");
const browser = new Window();
Object.assign(globalThis, { document: browser.document });

const setup = (side: "A" | "B" = "A") => {
  const element = document.createElement("div");
  let listener: (event: RiftEvent) => void = () => undefined;
  const unsubscribe = mock(() => undefined);
  const cleanup = attachReceiveActivity(element, "test", side, (receive) => {
    listener = receive;
    return unsubscribe;
  });
  const emit = (changes: Partial<Extract<RiftEvent, { type: "data" }>> = {}) => listener({
    type: "data", profile: "test", timestamp: "now", source: "A", target: "B", origin: "received", bytes: Uint8Array.of(65), length: 1, delivered: false, ...changes,
  });
  const active = () => element.hasAttribute("data-receiving");
  return { element, emit, active, cleanup, unsubscribe };
};

test("only matching received events activate the glow and it expires", async () => {
  const activity = setup();
  for (const changes of [{ origin: "forwarded" }, { origin: "injected" }, { source: "B" }, { profile: "other" }] as const) {
    activity.emit(changes);
    expect(activity.active()).toBe(false);
  }
  activity.emit();
  expect(activity.active()).toBe(true);
  await Bun.sleep(700);
  expect(activity.active()).toBe(false);
  activity.cleanup();
});

test("continuous traffic extends activity and sides stay independent", async () => {
  const a = setup();
  const b = setup("B");
  a.emit();
  await Bun.sleep(400);
  a.emit();
  await Bun.sleep(300);
  expect(a.active()).toBe(true);
  expect(b.active()).toBe(false);
  b.emit({ source: "B", target: "A" });
  b.cleanup();
  expect(b.active()).toBe(false);
  expect(b.unsubscribe).toHaveBeenCalledTimes(1);
  await Bun.sleep(400);
  expect(a.active()).toBe(false);
  a.cleanup();
});
