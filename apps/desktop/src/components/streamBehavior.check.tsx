import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
const browser = new Window();
Object.assign(globalThis, { window: browser, getComputedStyle: browser.getComputedStyle.bind(browser), document: browser.document, navigator: browser.navigator, HTMLElement: browser.HTMLElement, HTMLFormElement: browser.HTMLFormElement, DocumentFragment: browser.DocumentFragment, Event: browser.Event, CustomEvent: browser.CustomEvent, ResizeObserver: browser.ResizeObserver, IS_REACT_ACT_ENVIRONMENT: true });
const inject = mock(async (..._args: unknown[]) => undefined);
mock.module("@tauri-apps/api/core", () => ({ invoke: async () => undefined, Channel: class {} }));
mock.module("@/lib/tauriApi", () => ({ inject, previewPayload: async () => [65], bridgeStatus: async () => [], exportLog: async () => undefined }));
mock.module("@tauri-apps/plugin-dialog", () => ({ open: async () => "/tmp/payload.bin", save: async () => null }));
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { TooltipProvider } = await import("@/components/ui/tooltip");
const { InjectBar } = await import("@/components/InjectBar");
const { LogPanel } = await import("@/components/LogPanel");
const { bridgeStore, IDLE_BRIDGE } = await import("@/stores/bridgeStore");
const { injectHistoryStore } = await import("@/stores/injectHistoryStore");
const { logStore } = await import("@/stores/logStore");
const { rowFromEvent } = await import("@/lib/logRows");
const container = document.createElement("div");
document.body.append(container);
let root = createRoot(container);
afterEach(async () => { await act(async () => root.unmount()); root = createRoot(container); });
const click = async (label: string) => {
  const button = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
};
const row = (id: number) => ({ ...rowFromEvent({ type: "data", profile: "test", timestamp: "2026-11-16T00:00:00Z", source: "A", target: "B", origin: "received", bytes: Uint8Array.of(65), length: 1, delivered: true }), id });

test("scroll-up holds new rows, chip and manual bottom resume, explicit pause remains", async () => {
  let jumps = 0;
  browser.HTMLElement.prototype.scrollIntoView = () => { jumps += 1; };
  logStore.setState(() => ({ rows: { test: Array.from({ length: 100 }, (_, index) => row(index + 1)) } }));
  await act(async () => root.render(<TooltipProvider><LogPanel profileName="test" /></TooltipProvider>));
  const scroller = container.querySelector<HTMLDivElement>(".overflow-auto");
  if (!scroller) throw new Error("Missing scroller");
  Object.defineProperties(scroller, { scrollHeight: { value: 2234 }, clientHeight: { value: 600 } });
  const scroll = async (top: number, wheel = false) => act(async () => {
    if (wheel) scroller.dispatchEvent(new browser.WheelEvent("wheel", { deltaY: -100, bubbles: true }) as unknown as Event);
    scroller.scrollTop = top;
    scroller.dispatchEvent(new browser.Event("scroll", { bubbles: true }) as unknown as Event);
  });
  await scroll(1000);
  expect(container.textContent).not.toContain("Scroll to bottom");
  await scroll(900, true);
  expect(container.textContent).toContain("Scroll to bottom");
  await act(async () => scroller.dispatchEvent(new browser.Event("scrollend", { bubbles: true }) as unknown as Event));
  await scroll(1634);
  expect(container.textContent).toContain("Scroll to bottom");
  await scroll(900);
  const before = jumps;
  await act(async () => logStore.setState((state) => ({ rows: { test: [...state.rows.test, row(101)] } })));
  expect(jumps).toBe(before);
  expect(scroller.scrollTop).toBe(900);
  const chip = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Scroll to bottom");
  await act(async () => chip?.click());
  expect(jumps).toBeGreaterThan(before);
  await scroll(900, true);
  await act(async () => scroller.dispatchEvent(new browser.WheelEvent("wheel", { deltaY: 100, bubbles: true }) as unknown as Event));
  await scroll(1634);
  expect(container.textContent).not.toContain("Scroll to bottom");
  const resumedJumps = jumps;
  await act(async () => logStore.setState((state) => ({ rows: { test: [...state.rows.test, row(102)] } })));
  expect(jumps).toBeGreaterThan(resumedJumps);
  await click("Pause stream");
  const pausedJumps = jumps;
  await act(async () => logStore.setState((state) => ({ rows: { test: [...state.rows.test, row(103)] } })));
  expect(container.textContent).toContain("Paused · 1 new · Resume");
  expect(jumps).toBe(pausedJumps);
  await scroll(1634, true);
  expect(container.querySelector('[aria-label="Resume stream"]')?.getAttribute("aria-pressed")).toBe("true");
});

test("successful sends retain every payload format and file selection", async () => {
  bridgeStore.setState(() => ({ bridges: { test: { ...IDLE_BRIDGE, running: true } } }));
  for (const format of ["text", "hex", "binary", "file"] as const) {
    const value = format === "file" ? "/tmp/payload.bin" : "01000001";
    await act(async () => injectHistoryStore.setState(() => ({ test: [{ target: "B", format, value }] })));
    await act(async () => root.render(<TooltipProvider><InjectBar key={format} profileName="test" /></TooltipProvider>));
    const input = container.querySelector<HTMLInputElement>('[aria-label="Bytes to inject"]');
    await act(async () => input?.dispatchEvent(new browser.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }) as unknown as Event));
    await click("Send (Enter)");
    await click("Send (Enter)");
    expect(inject.mock.calls.slice(-2)).toEqual([["test", "B", format, value], ["test", "B", format, value]]);
    if (format === "file") expect(container.textContent).toContain("payload.bin");
    else expect(container.querySelector<HTMLInputElement>('[aria-label="Bytes to inject"]')?.value).toBe(value);
  }
});
