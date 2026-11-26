import type { PanelId } from "@/lib/panels";

export type Side = "left" | "right" | "top" | "bottom";

export type Box = { left: number; top: number; width: number; height: number };

export type PanelDrop =
  | { kind: "swap"; target: PanelId }
  | { kind: "split"; target: PanelId; side: Side }
  | { kind: "edge"; side: "left" | "right" };

export type Point = { x: number; y: number };

export type DropQuery = {
  source: PanelId;
  target: PanelId;
  point: Point;
  targetBox: Box;
  workspaceBox: Box;
};

const WINDOW_EDGE_PIXELS = 16;
const SPLIT_ZONE = 0.25;
const WINDOW_EDGE_SHARE = 0.2;

const isStackedOnly = (panel: PanelId) => panel === "inject";

const windowEdge = ({ source, point, workspaceBox }: DropQuery) => {
  if (isStackedOnly(source)) return null;
  if (point.x - workspaceBox.left < WINDOW_EDGE_PIXELS) return "left";
  if (workspaceBox.left + workspaceBox.width - point.x < WINDOW_EDGE_PIXELS) return "right";
  return null;
};

export const resolveDrop = (query: DropQuery): PanelDrop | null => {
  const edge = windowEdge(query);
  if (edge) return { kind: "edge", side: edge };

  const { source, target, point, targetBox } = query;
  if (source === target) return null;
  const x = (point.x - targetBox.left) / targetBox.width;
  const y = (point.y - targetBox.top) / targetBox.height;
  const stacked = isStackedOnly(source) || isStackedOnly(target);

  if (stacked) return { kind: "split", target, side: y < 0.5 ? "top" : "bottom" };

  const distances: [Side, number][] = [
    ["left", x],
    ["right", 1 - x],
    ["top", y],
    ["bottom", 1 - y],
  ];
  const [side, distance] = distances.reduce((near, next) => (next[1] < near[1] ? next : near));
  return distance < SPLIT_ZONE ? { kind: "split", target, side } : { kind: "swap", target };
};

const half = ({ left, top, width, height }: Box, side: Side, share: number): Box => {
  const box = { left, top, width, height };
  if (side === "left") return { ...box, width: width * share };
  if (side === "right") return { ...box, left: left + width * (1 - share), width: width * share };
  if (side === "top") return { ...box, height: height * share };
  return { ...box, top: top + height * (1 - share), height: height * share };
};

export const previewBox = (drop: PanelDrop, targetBox: Box, workspaceBox: Box): Box => {
  if (drop.kind === "swap") return targetBox;
  if (drop.kind === "edge") return half(workspaceBox, drop.side, WINDOW_EDGE_SHARE);
  return half(targetBox, drop.side, 0.5);
};
