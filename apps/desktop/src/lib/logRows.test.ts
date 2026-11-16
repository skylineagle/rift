import { expect, test } from "bun:test";

import { dropText, matchesFilter, rowFromEvent, rowToText } from "@/lib/logRows";
import type { DataEvent, Origin, SideName } from "@/lib/types";

const eventFor = (origin: Origin, source: SideName = "A", delivered = true): DataEvent => ({
  type: "data", profile: "test", timestamp: "2026-11-16T00:00:00Z",
  source, target: source === "A" ? "B" : "A", origin, bytes: [104, 105], delivered,
});

test("receive rows identify the side and are separate from direction filters", () => {
  for (const side of ["A", "B"] as const) {
    const row = rowFromEvent(eventFor("received", side));
    expect(row.type === "data" && row.direction).toBe(side);
    expect(rowToText(row)).toContain(`${side} received 2B`);
    expect(matchesFilter(row, { direction: side, injectedOnly: false, query: "hi" })).toBe(true);
    expect(matchesFilter(row, { direction: side === "A" ? "AB" : "BA", injectedOnly: false, query: "" })).toBe(false);
    expect(matchesFilter(row, { direction: "all", injectedOnly: true, query: "" })).toBe(false);
  }
});

test("forward and injection rows retain direction and searchable payloads", () => {
  const forwarded = rowFromEvent(eventFor("forwarded"));
  expect(rowToText(forwarded)).toContain("A->B 2B");
  expect(matchesFilter(forwarded, { direction: "AB", injectedOnly: false, query: "6869" })).toBe(true);
  const injection = rowFromEvent(eventFor("injected", "B", false));
  expect(rowToText(injection)).toContain("B->A 2B injected not-delivered");
  expect(matchesFilter(injection, { direction: "BA", injectedOnly: true, query: "hi" })).toBe(true);
  expect(matchesFilter(injection, { direction: "BA", injectedOnly: true, query: "not delivered" })).toBe(true);
});

test("genuine transport errors remain error status rows", () => {
  expect(rowFromEvent({ type: "status", profile: "test", timestamp: "2026-11-16T00:00:00Z", side: "B", state: { state: "error", message: "broken pipe" } })).toMatchObject({ type: "status", level: "err", side: "B" });
});

test("listener unavailability explains the injection result in rows, searches and exports", () => {
  const row = rowFromEvent({
    ...eventFor("injected", "B", false),
    undelivered_reason: "listening but has no connected clients",
  });
  expect(rowToText(row)).toContain("Not delivered: Side A is listening but has no connected clients");
  expect(matchesFilter(row, { direction: "BA", injectedOnly: true, query: "no connected clients" })).toBe(true);
  expect(row).toMatchObject({ type: "data", origin: "injected", delivered: false, bytes: [104, 105] });
});

test("paused injections explain both targets as data rows without error labels", () => {
  for (const source of ["A", "B"] as const) {
    const row = rowFromEvent({ ...eventFor("injected", source, false), undelivered_reason: "paused" });
    expect(row.type).toBe("data");
    if (row.type !== "data") throw new Error("Expected a data row");
    const target = source === "A" ? "B" : "A";
    expect(dropText(row)).toBe(`Not delivered: Side ${target} is paused`);
    expect(rowToText(row)).toContain(dropText(row));
    expect(rowToText(row).toLowerCase()).not.toContain("error");
    expect(matchesFilter(row, { direction: "all", injectedOnly: true, query: "paused" })).toBe(true);
    expect(row).toMatchObject({ origin: "injected", delivered: false, bytes: [104, 105] });
  }
});
