import type { ConnectionState, EndpointKind } from "@/lib/types";

export type SideStatusName =
  | "idle"
  | "connecting"
  | "listening"
  | "connected"
  | "disconnected"
  | "error"
  | "disabled";

export type SideRuntime = {
  status: SideStatusName;
  peers: string[];
  detail: string;
};

export const IDLE_SIDE: SideRuntime = { status: "idle", peers: [], detail: "" };

const LABELS: Record<SideStatusName, string> = {
  idle: "Stopped",
  connecting: "Connecting",
  listening: "Listening",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
  disabled: "Paused",
};

export const statusLabel = (kind: EndpointKind, status: SideStatusName) =>
  kind === "uart" && status === "connected" ? "Open" : LABELS[status];

export const nextSideRuntime = (
  current: SideRuntime,
  state: ConnectionState,
): SideRuntime => {
  switch (state.state) {
    case "disabled":
      return { status: "disabled", peers: [], detail: "" };
    case "listening":
      return { status: "listening", peers: [], detail: "" };
    case "connecting":
      return { status: "connecting", peers: [], detail: "" };
    case "connected": {
      const peers = current.peers.includes(state.peer)
        ? current.peers
        : [...current.peers, state.peer];
      return { status: "connected", peers, detail: "" };
    }
    case "disconnected": {
      const peers = state.peer
        ? current.peers.filter((peer) => peer !== state.peer)
        : [];
      return {
        status: peers.length > 0 ? "connected" : "disconnected",
        peers,
        detail: "",
      };
    }
    case "error":
      return { ...current, status: "error", detail: state.message };
  }
};

export const describeConnectionState = (state: ConnectionState) => {
  switch (state.state) {
    case "disabled":
      return "disabled";
    case "listening":
      return "listening";
    case "connecting":
      return "connecting";
    case "connected":
      return `connected ${state.peer}`;
    case "disconnected":
      return state.peer ? `disconnected ${state.peer}` : "disconnected";
    case "error":
      return `error: ${state.message}`;
  }
};

export const overallStatus = (
  running: boolean,
  statuses: [SideStatusName, SideStatusName],
): SideStatusName => {
  if (!running) return "idle";
  const active = statuses.filter((status) => status !== "disabled");
  if (active.length === 0) return "idle";
  if (active.includes("error")) return "error";
  if (active.includes("connecting")) return "connecting";
  if (active.includes("listening")) return "listening";
  if (active.includes("disconnected")) return "disconnected";
  return "connected";
};

export const sideDetail = (
  kind: EndpointKind,
  runtime: SideRuntime,
  running: boolean,
) => {
  if (runtime.status === "disabled") return "paused";
  if (!running || runtime.status === "idle") return "not running";
  if (runtime.status === "error") return runtime.detail;
  if (runtime.status === "listening") {
    return kind === "udp-server" ? "waiting for first datagram" : "no peers yet";
  }
  if (runtime.status === "connecting") return "connecting";
  if (runtime.status === "disconnected") return "disconnected";
  return "";
};
