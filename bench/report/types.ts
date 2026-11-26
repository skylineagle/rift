export type Kind = "tcp-server" | "tcp-client" | "udp-server" | "udp-client" | "uart";
export type Platform = "macos" | "linux";

export const KINDS: Kind[] = ["tcp-server", "tcp-client", "udp-server", "udp-client", "uart"];

export interface Latency {
  mean_us: number;
  p50_us: number;
  p90_us: number;
  p99_us: number;
  p999_us: number;
  max_us: number;
}

export interface Flow {
  name: string;
  frame_size: number;
  sent_frames: number;
  received_frames: number;
  lost_frames: number;
  loss_pct: number;
  out_of_order: number;
  corrupt_frames: number;
  garbage_bytes: number;
  send_retries: number;
  offered_mbps: number;
  goodput_mbps: number;
  latency: Latency;
  error: string | null;
}

export interface Usage {
  rss_start_mb: number;
  rss_peak_mb: number;
  rss_end_mb: number;
  cpu_avg_pct: number;
  cpu_peak_pct: number;
  threads: number;
  open_files: number;
}

export interface CaseResult {
  suite: string;
  a: Kind;
  b: Kind;
  direction: "a-to-b" | "b-to-a" | "both";
  frame_size: number;
  rate_mbps: number | null;
  duration_s: number;
  log: "hex-quiet" | "quiet" | "json" | "hex" | "text";
  ready: boolean;
  flows: Flow[];
  rift: Usage;
  rift_dropped_chunks: number;
  rift_errors: string[];
  error: string | null;
}

export interface BaselineResult {
  suite: "baseline";
  transport: "tcp" | "udp";
  frame_size: number;
  rate_mbps: number | null;
  flow: Flow;
}

export interface TickFlow {
  name: string;
  mbps: number;
  sent_total: number;
  received_total: number;
  lost_total: number;
  corrupt_total: number;
  p50_us: number;
  p99_us: number;
  max_us: number;
}

export interface Tick {
  kind: "tick";
  elapsed_s: number;
  rift: { rss_mb: number; cpu_pct: number; threads: number; open_files: number };
  flows: TickFlow[];
  dropped_chunks: number;
  errors: number;
}

export interface SoakFinal {
  kind: "final";
  minutes: number;
  survived: boolean;
  flows: Flow[];
  rift: Usage;
  dropped_chunks: number;
  errors: string[];
  config: string;
}

export interface Point {
  x: number;
  y: number;
  tip: string;
}

export interface Series {
  name: string;
  color: string;
  points: Point[];
  dashed?: boolean;
  markers?: boolean;
}
