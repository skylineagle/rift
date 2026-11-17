import { color } from "./tokens";

export type MarkDot = { x: number; y: number; r: number; fill: string };

const amber: [number, number, number][] = [[16, 22, 2], [24, 22, 2.4], [32, 22, 2.7], [40, 22, 2.9], [48, 22, 3], [40, 14, 2.6], [40, 30, 2.6]];
const cyan: [number, number, number][] = [[48, 42, 2], [40, 42, 2.4], [32, 42, 2.7], [24, 42, 2.9], [16, 42, 3], [24, 34, 2.6], [24, 50, 2.6]];

export const MARK: MarkDot[] = [
  ...amber.map(([x, y, r]) => ({ x, y, r, fill: color.amber })),
  ...cyan.map(([x, y, r]) => ({ x, y, r, fill: color.cyan })),
];

export const isAmber = (index: number) => index < 7;
