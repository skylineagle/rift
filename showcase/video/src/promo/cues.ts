import { at, type Grid } from "../kit/time";
import beats from "./beats.json";

export const GRID: Grid = { bpm: Math.round(beats.bpm), firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 };

export const b = (bar: number, beat = 1, fraction = 0) => at(GRID, bar, beat, fraction);

export const BARS = 15;
export const DURATION = b(BARS + 1);

export const cue = {
  open: { lockup: b(2, 1), word: b(2, 1), end: b(3, 1) },
  pipe: { start: b(3, 1), end: b(4, 1) },
  cli: { start: b(4, 1), typeEnd: b(4, 3, 0.5), enter: b(4, 4), streams: b(4, 1), end: b(6, 1) },
  see: { start: b(6, 1), end: b(7, 1) },
  inspect: { start: b(7, 1), firstRow: b(7, 1, 0.5), rowStep: 0.125, expand: b(8, 1), hex: b(8, 3), end: b(9, 1) },
  inject: { start: b(10, 1), typeStart: b(10, 1, 0.25), typeEnd: b(10, 2, 0.75), send: b(10, 3), reply: b(10, 4), end: b(11, 1) },
  injectWords: { start: b(9, 1), end: b(10, 1) },
  every: { start: b(11, 1), end: b(12, 1) },
  profiles: { start: b(12, 1), rows: [b(12, 2), b(12, 3), b(12, 4)], run: b(13, 1), os: [b(13, 1, 0.5), b(13, 2), b(13, 2, 0.5)], update: b(13, 3), end: b(14, 1) },
  end: { start: b(14, 1), lockup: b(14, 1, 0.25), word: b(14, 2), url: b(14, 3), fade: b(15, 3), done: b(16, 1) },
} as const;
