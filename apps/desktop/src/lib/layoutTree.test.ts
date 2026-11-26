import { expect, test } from "bun:test";
import type { SerializedDockview } from "dockview-react";

import { isStackedVertically, swapPanels } from "@/lib/layoutTree";

const leaf = (id: string, size: number) => ({ type: "leaf" as const, size, data: { id, views: [id] } });
const layout = {
  grid: {
    orientation: "HORIZONTAL",
    root: { type: "branch", data: [leaf("profiles", 200), { type: "branch", size: 800, data: [leaf("log", 500), leaf("inject", 47)] }] },
  },
} as unknown as SerializedDockview;

test("swapping exchanges panels while each slot keeps its size", () => {
  const root = swapPanels(layout, "profiles", "log").grid.root;
  expect(root.data).toMatchObject([
    { size: 200, data: { views: ["log"] } },
    { data: [{ size: 500, data: { views: ["profiles"] } }, { data: { views: ["inject"] } }] },
  ]);
});

test("stacking follows the direction of the parent split", () => {
  expect(isStackedVertically(layout, "inject")).toBe(true);
  expect(isStackedVertically(layout, "profiles")).toBe(false);
});
