import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { previewBox, resolveDrop, type DropQuery } from "@/lib/panelDrop";

const workspaceBox = { left: 0, top: 0, width: 1000, height: 800 };
const targetBox = { left: 200, top: 200, width: 400, height: 400 };
const query = (overrides: Partial<DropQuery>): DropQuery => ({
  source: "profiles",
  target: "log",
  point: { x: 400, y: 400 },
  targetBox,
  workspaceBox,
  ...overrides,
});

test("the center swaps and the borders split", () => {
  expect(resolveDrop(query({}))).toEqual({ kind: "swap", target: "log" });
  expect(resolveDrop(query({ point: { x: 590, y: 400 } }))).toEqual({ kind: "split", target: "log", side: "right" });
  expect(resolveDrop(query({ point: { x: 400, y: 210 } }))).toEqual({ kind: "split", target: "log", side: "top" });
});

test("the window edge wins, even over the dragged panel", () => {
  expect(resolveDrop(query({ target: "profiles", point: { x: 995, y: 400 } }))).toEqual({ kind: "edge", side: "right" });
  expect(resolveDrop(query({ target: "profiles" }))).toBeNull();
});

test("inject only stacks above or below", () => {
  expect(resolveDrop(query({ source: "inject", point: { x: 590, y: 390 } }))).toEqual({ kind: "split", target: "log", side: "top" });
  expect(resolveDrop(query({ target: "inject" }))).toEqual({ kind: "split", target: "inject", side: "bottom" });
  expect(resolveDrop(query({ source: "inject", point: { x: 995, y: 450 } }))).toEqual({ kind: "split", target: "log", side: "bottom" });
});

test("split previews are complete boxes when measured from the DOM", () => {
  const measured = new (new Window().DOMRect)(200, 200, 400, 400);
  expect(previewBox({ kind: "split", target: "log", side: "right" }, measured, measured)).toEqual({ left: 400, top: 200, width: 200, height: 400 });
  expect(previewBox({ kind: "edge", side: "left" }, measured, measured)).toEqual({ left: 200, top: 200, width: 80, height: 400 });
});
