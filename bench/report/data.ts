import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BaselineResult, CaseResult, Flow, Kind, Platform, SoakFinal, Tick } from "./types";

export const LOSSLESS_PCT = 0.1;

export const readJsonl = <T>(path: string): T[] =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as T)
    : [];

export interface PlatformResults {
  platform: Platform;
  baseline: BaselineResult[];
  matrix: CaseResult[];
  frames: CaseResult[];
  logs: CaseResult[];
  ticks: Tick[];
  soak: SoakFinal | null;
  overload: Tick[];
}

export const loadPlatform = (directory: string, platform: Platform): PlatformResults => {
  const root = join(directory, platform);
  const soakLines = readJsonl<Tick | SoakFinal>(join(root, "soak", "soak.jsonl"));
  return {
    platform,
    baseline: readJsonl<BaselineResult>(join(root, "baseline.jsonl")),
    matrix: readJsonl<CaseResult>(join(root, "matrix.jsonl")),
    frames: readJsonl<CaseResult>(join(root, "frames.jsonl")),
    logs: readJsonl<CaseResult>(join(root, "logs.jsonl")),
    ticks: soakLines.filter((line): line is Tick => line.kind === "tick"),
    soak: soakLines.find((line): line is SoakFinal => line.kind === "final") ?? null,
    overload: readJsonl<Tick | SoakFinal>(join(root, "soak-overload", "soak.jsonl")).filter(
      (line): line is Tick => line.kind === "tick",
    ),
  };
};

export const source = (result: CaseResult): Kind => (result.direction === "b-to-a" ? result.b : result.a);
export const destination = (result: CaseResult): Kind => (result.direction === "b-to-a" ? result.a : result.b);
export const flowOf = (result: CaseResult): Flow => result.flows[0];

export interface Sweep {
  source: Kind;
  destination: Kind;
  points: CaseResult[];
}

const rateOrder = (rate: number | null) => rate ?? Number.POSITIVE_INFINITY;

export const sweeps = (matrix: CaseResult[]): Sweep[] => {
  const groups = new Map<string, Sweep>();
  for (const result of matrix) {
    if (result.direction === "both" || result.flows.length === 0) continue;
    const key = `${source(result)}>${destination(result)}`;
    const group = groups.get(key) ?? { source: source(result), destination: destination(result), points: [] };
    group.points.push(result);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.points.sort((left, right) => rateOrder(left.rate_mbps) - rateOrder(right.rate_mbps));
  return [...groups.values()];
};

export const findSweep = (all: Sweep[], from: Kind, to: Kind) =>
  all.find((sweep) => sweep.source === from && sweep.destination === to);

export const isLossless = (result: CaseResult) => {
  const flow = flowOf(result);
  return flow.loss_pct < LOSSLESS_PCT && flow.corrupt_frames === 0;
};

export const maxLossless = (sweep: Sweep) => {
  const clean = sweep.points.filter(isLossless);
  if (clean.length === 0) return null;
  return clean.reduce((best, result) => (flowOf(result).goodput_mbps > flowOf(best).goodput_mbps ? result : best));
};

export const unlimited = (sweep: Sweep) => sweep.points.find((result) => result.rate_mbps === null) ?? null;

export const atRate = (sweep: Sweep, rate: number) => sweep.points.find((result) => result.rate_mbps === rate) ?? null;

export const bidirectional = (matrix: CaseResult[]) => matrix.filter((result) => result.direction === "both");
