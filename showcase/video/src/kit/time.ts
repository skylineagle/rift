import { useCurrentFrame, useVideoConfig } from "remotion";

export type Grid = {
  bpm: number;
  firstBeat: number;
  pickupBeats: number;
  beatsPerBar: number;
};

export const beatLength = (grid: Grid) => 60 / grid.bpm;

export const at = (grid: Grid, bar: number, beat = 1, fraction = 0) => {
  const index = grid.pickupBeats + (bar - 1) * grid.beatsPerBar + (beat - 1) + fraction;
  return grid.firstBeat + index * beatLength(grid);
};

export const useTime = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const progress = (t: number, start: number, length: number) =>
  length <= 0 ? (t >= start ? 1 : 0) : clamp01((t - start) / length);
