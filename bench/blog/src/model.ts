import type { Kind, Platform, Point } from "./types";

export const KINDS: Kind[] = ["tcp-server", "tcp-client", "udp-server", "udp-client", "uart"];

export const KIND_LABEL: Record<Kind, string> = {
  "tcp-server": "TCP server",
  "tcp-client": "TCP client",
  "udp-server": "UDP server",
  "udp-client": "UDP client",
  uart: "UART",
};

export const KIND_ROLE: Record<Kind, string> = {
  "tcp-server": "your app connects to Rift",
  "tcp-client": "Rift connects to your app",
  "udp-server": "Rift listens, answers peers",
  "udp-client": "Rift sends to one address",
  uart: "serial port",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  macos: "macOS · M3 Pro, 11 cores",
  linux: "Linux · 2 vCPU VPS",
};

export const CLEAN_LOSS = 0.1;
export const LEAKING_LOSS = 5;
export const BAUD_115200 = 0.0115;

export type Verdict = "clean" | "leaking" | "overloaded";

export const verdictOf = (point: Point): Verdict =>
  point.loss < CLEAN_LOSS ? "clean" : point.loss < LEAKING_LOSS ? "leaking" : "overloaded";

export const VERDICT_LABEL: Record<Verdict, string> = {
  clean: "Clean",
  leaking: "Leaking",
  overloaded: "Overloaded",
};

export const pairKey = (source: Kind, destination: Kind) => `${source}>${destination}`;

export const sweepOf = (platform: Platform, source: Kind, destination: Kind): Point[] =>
  BLOG_DATA[platform][pairKey(source, destination)] ?? [];

export const cleanCeiling = (points: Point[]) => {
  const firstLossy = points.findIndex((point) => verdictOf(point) !== "clean");
  const reliable = firstLossy === -1 ? points : points.slice(0, firstLossy);
  return reliable.reduce((best, point) => Math.max(best, point.delivered), 0);
};

export const firstLossyRate = (points: Point[]) =>
  points.find((point) => point.rate !== null && verdictOf(point) !== "clean")?.rate ?? null;

export const peakDelivered = (points: Point[]) => points.reduce((best, point) => Math.max(best, point.delivered), 0);

export const formatRate = (megabytes: number) => {
  if (megabytes < 1) return `${(megabytes * 1000).toFixed(megabytes < 0.1 ? 1 : 0)} KB/s`;
  if (megabytes >= 1000) return `${(megabytes / 1000).toFixed(1)} GB/s`;
  return `${megabytes >= 100 ? megabytes.toFixed(0) : Number(megabytes.toFixed(1))} MB/s`;
};

export const formatOffered = (rate: number | null) => {
  if (rate === null) return "flat out";
  if (rate === BAUD_115200) return "11.5 KB/s (115200 baud)";
  return formatRate(rate);
};

export const formatLoss = (loss: number) => (loss === 0 ? "0%" : loss < 1 ? `${loss.toFixed(1)}%` : `${loss.toFixed(0)}%`);
