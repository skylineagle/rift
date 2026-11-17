import { step, type SpringConfig } from "../kit/spring";
import { cue } from "./cues";
import { cli, lockup, profileDot, rowArrow, app } from "./layout";
import { MARK, isAmber } from "./mark";
import { PATTERN } from "./data";

export type Particle = { x: number; y: number; r: number; o: number };
type State = (t: number, index: number) => Particle;
type Key = { at: number; state: State; delay?: (index: number) => number; snap?: boolean; spring?: SpringConfig };

const glide: SpringConfig = { stiffness: 150, damping: 20 };

const markAt = (cx: number, cy: number, scale: number): State => (_t, index) => ({
  x: cx + (MARK[index].x - 32) * scale,
  y: cy + (MARK[index].y - 32) * scale,
  r: MARK[index].r * scale,
  o: 1,
});

const hash = (index: number, salt: number) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const scatter: State = (_t, index) => {
  const angle = hash(index, 1) * Math.PI * 2;
  const distance = 420 + hash(index, 2) * 260;
  return { x: 960 + Math.cos(angle) * distance, y: 540 + Math.sin(angle) * distance * 0.6, r: 4, o: 0 };
};

const streams: State = (t, index) => {
  const amber = isAmber(index);
  const lane = index % 7;
  const phase = ((t - cue.cli.streams) * 0.42 + lane / 7) % 1;
  const along = amber ? phase : 1 - phase;
  const { from, to, amberY, cyanY } = cli.streams;
  return { x: from + (to - from) * along, y: amber ? amberY : cyanY, r: 9, o: Math.min(1, Math.sin(Math.PI * phase) * 3) };
};

const rowOrder = (() => {
  const amberRows = PATTERN.flatMap((direction, row) => (direction === "AB" ? [row] : []));
  const cyanRows = PATTERN.flatMap((direction, row) => (direction === "BA" ? [row] : []));
  return [...amberRows, ...cyanRows];
})();

export const rowTime = (row: number) => cue.inspect.firstRow + row * cue.inspect.rowStep;

const intoRows: State = (t, index) => {
  const row = rowOrder[index];
  const point = rowArrow(Math.min(row, app.rowSlots - 1));
  return { x: point.x, y: point.y, r: 7, o: t < rowTime(row) ? 1 : 0 };
};

const fromDots: State = (_t, index) => {
  const point = profileDot(index % 3);
  return { x: point.x, y: point.y, r: 6, o: 1 };
};

const smallMark = markAt(960, 330, 3);
const bigLockup = markAt(lockup.markX, lockup.markY, lockup.markScale);

const KEYS: Key[] = [
  { at: 0, state: scatter },
  { at: 0, state: markAt(960, 540, 8), delay: (index) => index * 0.035 },
  { at: cue.open.lockup, state: bigLockup },
  { at: cue.pipe.start - 0.15, state: smallMark },
  { at: cue.cli.start - 0.2, state: streams, delay: (index) => (index % 7) * 0.03 },
  { at: cue.see.start - 0.2, state: smallMark },
  { at: cue.inspect.start, state: intoRows, delay: (index) => rowTime(rowOrder[index]) - 0.5 - cue.inspect.start },
  { at: cue.end.start, state: fromDots, snap: true },
  { at: cue.end.lockup - 0.15, state: bigLockup, delay: (index) => index * 0.025 },
  { at: cue.end.fade, state: (t, index) => ({ ...bigLockup(t, index), o: 0 }), spring: { stiffness: 220, damping: 30 } },
];

const mix = (a: Particle, b: Particle, w: number): Particle => ({
  x: a.x + (b.x - a.x) * w,
  y: a.y + (b.y - a.y) * w,
  r: a.r + (b.r - a.r) * w,
  o: a.o + (b.o - a.o) * w,
});

export const particleAt = (t: number, index: number) => {
  let value = KEYS[0].state(t, index);
  for (const key of KEYS.slice(1)) {
    const start = key.at + (key.delay?.(index) ?? 0);
    const weight = key.snap ? (t >= start ? 1 : 0) : step(t - start, key.spring ?? glide);
    if (weight > 0) value = mix(value, key.state(t, index), weight);
  }
  return value;
};
