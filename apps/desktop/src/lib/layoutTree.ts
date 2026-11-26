import type { SerializedDockview } from "dockview-react";

import type { PanelId } from "@/lib/panels";

type Node = SerializedDockview["grid"]["root"];
type LeafData = Extract<Node["data"], { views: string[] }>;

const isLeafData = (data: Node["data"]): data is LeafData => !Array.isArray(data);

const mapLeaves = (node: Node, map: (data: LeafData) => LeafData): Node =>
  isLeafData(node.data)
    ? { ...node, data: map(node.data) }
    : { ...node, data: node.data.map((child) => mapLeaves(child, map)) };

const leaves = (node: Node): LeafData[] =>
  isLeafData(node.data) ? [node.data] : node.data.flatMap(leaves);

export const swapPanels = (
  layout: SerializedDockview,
  first: PanelId,
  second: PanelId,
): SerializedDockview => {
  const all = leaves(layout.grid.root);
  const firstLeaf = all.find((leaf) => leaf.views.includes(first));
  const secondLeaf = all.find((leaf) => leaf.views.includes(second));
  if (!firstLeaf || !secondLeaf) return layout;

  const root = mapLeaves(layout.grid.root, (leaf) => {
    if (leaf === firstLeaf) return secondLeaf;
    if (leaf === secondLeaf) return firstLeaf;
    return leaf;
  });
  return { ...layout, grid: { ...layout.grid, root } };
};

export const isStackedVertically = (layout: SerializedDockview, panel: PanelId) => {
  const search = (node: Node, vertical: boolean): boolean | null => {
    if (isLeafData(node.data)) return null;
    for (const child of node.data) {
      if (isLeafData(child.data) && child.data.views.includes(panel)) return vertical;
      const found = search(child, !vertical);
      if (found !== null) return found;
    }
    return null;
  };
  return search(layout.grid.root, layout.grid.orientation === "VERTICAL") ?? false;
};
