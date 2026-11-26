export type SideName = "A" | "B";
export type Target = "A" | "B" | "Both";
export type PayloadFormat = "text" | "hex" | "binary" | "file";
export type Origin = "received" | "forwarded" | "injected";

export type SideSwitch = { enabled: boolean };

export type TcpClientEndpoint = SideSwitch & {
  kind: "tcp-client";
  address: string;
  reconnect_delay_ms: number;
  connect_timeout_ms: number;
  no_delay: boolean;
};
export type TcpServerEndpoint = SideSwitch & {
  kind: "tcp-server";
  bind: string;
  max_clients: number | null;
  no_delay: boolean;
};
export type UdpClientEndpoint = SideSwitch & {
  kind: "udp-client";
  remote: string;
  bind?: string | null;
};
export type ReplyTo = "all" | "last";
export type UdpServerEndpoint = SideSwitch & {
  kind: "udp-server";
  bind: string;
  reply_to: ReplyTo;
  peer_timeout_secs: number | null;
};
export type Parity = "none" | "odd" | "even";
export type FlowControl = "none" | "software" | "hardware";
export type UartEndpoint = SideSwitch & {
  kind: "uart";
  port: string;
  baud_rate: number;
  data_bits: number;
  parity: Parity;
  stop_bits: number;
  flow_control: FlowControl;
};

export type Endpoint =
  | TcpClientEndpoint
  | TcpServerEndpoint
  | UdpClientEndpoint
  | UdpServerEndpoint
  | UartEndpoint;

export type EndpointKind = Endpoint["kind"];

export type WorkflowStep =
  | { action: "send"; target: Target; format: PayloadFormat; payload: string }
  | { action: "wait"; millis: number };

export type Workflow = {
  name: string;
  autostart: boolean;
  repeat?: number;
  steps: WorkflowStep[];
};

export type WorkflowStatus = {
  profile: string;
  workflow: string;
  cycle: number;
  step: number;
};

export type LogLevel = "debug" | "info" | "warn" | "error";
export type ConsoleFormat = "text" | "json";
export type RotationPolicy = "size" | "hourly" | "daily";
export type HttpFormat = "ndjson" | "json-array";

export type ConsoleSinkConfig = { enabled: boolean; format: ConsoleFormat };

export type FileSinkConfig = {
  enabled: boolean;
  directory?: string;
  file_name: string;
  rotate: RotationPolicy;
  max_file_bytes: number;
  max_files: number;
  max_total_bytes?: number;
};

export type HttpSinkConfig = {
  enabled: boolean;
  url: string;
  format: HttpFormat;
  batch_size: number;
  flush_interval_secs: number;
  timeout_secs: number;
  headers: Record<string, string>;
};

export type LoggingConfig = {
  level: LogLevel;
  stats_interval_secs: number;
  console: ConsoleSinkConfig;
  file: FileSinkConfig;
  http: HttpSinkConfig;
};

export type Profile = {
  name: string;
  a: Endpoint;
  b: Endpoint;
  workflows?: Workflow[];
};

export type ConnectionState =
  | { state: "disabled" }
  | { state: "listening" }
  | { state: "connecting" }
  | { state: "connected"; peer: string }
  | { state: "disconnected"; peer: string | null }
  | { state: "error"; message: string };

export type DataEvent = {
  type: "data";
  profile: string;
  timestamp: string;
  source: SideName;
  target: SideName;
  origin: Origin;
  bytes: Uint8Array;
  length: number;
  delivered: boolean;
  undelivered_reason?: string;
};

export type StatusEvent = {
  type: "status";
  profile: string;
  timestamp: string;
  side: SideName;
  state: ConnectionState;
};

export type DroppedEvent = {
  type: "dropped";
  profile: string;
  timestamp: string;
  side: SideName;
  peer?: string;
  chunks: number;
};

export type SkippedEvent = {
  type: "skipped";
  profile: string;
  timestamp: string;
  source: SideName;
  target: SideName;
  origin: Origin;
  delivered: boolean;
  chunks: number;
  length: number;
};

export type WorkflowState =
  | { state: "started" }
  | { state: "step"; cycle: number; step: number }
  | { state: "finished" }
  | { state: "stopped" }
  | { state: "failed"; message: string };

export type WorkflowEvent = {
  type: "workflow";
  profile: string;
  timestamp: string;
  workflow: string;
  state: WorkflowState;
};

export type RiftEvent = DataEvent | StatusEvent | DroppedEvent | SkippedEvent | WorkflowEvent;

export type SideStatus = { state: ConnectionState; peers: number };
export type BridgeStatus = { profile: string; a: SideStatus; b: SideStatus };

export type SerialPortInfo = {
  name: string;
  kind: string;
  description: string | null;
};
