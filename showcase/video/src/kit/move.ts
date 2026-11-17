import { clamp01 } from "./time";

export const swapIn = (t: number, from: number, to: number, delay = 0, out = 0.18) => {
  const enter = clamp01((t - from - delay) / 0.25);
  const leave = to === Infinity ? 0 : clamp01((t - (to - out)) / out);
  const value = enter * (1 - leave);
  return { opacity: value, filter: value < 1 ? `blur(${(1 - value) * 12}px)` : undefined, visible: value > 0 };
};
