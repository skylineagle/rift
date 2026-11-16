import { Plug, Radio, Send, Server, Usb, type LucideIcon } from "lucide-react";

import { formatInteger } from "@/lib/format";
import type { Endpoint, EndpointKind } from "@/lib/types";

export type EndpointKindMeta = {
  kind: EndpointKind;
  label: string;
  icon: LucideIcon;
};

export const ENDPOINT_KINDS: EndpointKindMeta[] = [
  { kind: "tcp-client", label: "TCP client", icon: Plug },
  { kind: "tcp-server", label: "TCP server", icon: Server },
  { kind: "udp-client", label: "UDP client", icon: Send },
  { kind: "udp-server", label: "UDP server", icon: Radio },
  { kind: "uart", label: "Serial", icon: Usb },
];

export const endpointKindMeta = (kind: EndpointKind) =>
  ENDPOINT_KINDS.find((meta) => meta.kind === kind) ?? ENDPOINT_KINDS[0];

export const defaultEndpoint = (kind: EndpointKind): Endpoint => {
  switch (kind) {
    case "tcp-client":
      return {
        kind,
        enabled: true,
        address: "127.0.0.1:4000",
        reconnect_delay_ms: 1000,
        connect_timeout_ms: 5000,
        no_delay: true,
      };
    case "tcp-server":
      return { kind, enabled: true, bind: "0.0.0.0:9000", max_clients: null, no_delay: true };
    case "udp-client":
      return { kind, enabled: true, remote: "127.0.0.1:9001", bind: null };
    case "udp-server":
      return {
        kind,
        enabled: true,
        bind: "0.0.0.0:9000",
        reply_to: "all",
        peer_timeout_secs: null,
      };
    case "uart":
      return {
        kind,
        enabled: true,
        port: "",
        baud_rate: 115200,
        data_bits: 8,
        parity: "none",
        stop_bits: 1,
        flow_control: "none",
      };
  }
};

const shortPortName = (port: string) =>
  port.replace("/dev/tty.", "").replace("/dev/", "");

export const endpointAddress = (endpoint: Endpoint) => {
  switch (endpoint.kind) {
    case "tcp-client":
      return endpoint.address;
    case "udp-client":
      return endpoint.remote;
    case "uart":
      return shortPortName(endpoint.port) || "No port";
    default:
      return endpoint.bind;
  }
};

export const uartFrame = (endpoint: Extract<Endpoint, { kind: "uart" }>) =>
  `${endpoint.data_bits}${endpoint.parity[0].toUpperCase()}${endpoint.stop_bits}`;

export const endpointSubtitle = (endpoint: Endpoint, peerCount: number) => {
  if (endpoint.kind === "uart") {
    return `Serial · ${formatInteger(endpoint.baud_rate)} ${uartFrame(endpoint)}`;
  }
  const label = endpointKindMeta(endpoint.kind).label;
  if (endpoint.kind !== "tcp-server") return label;
  return peerCount > 0
    ? `${label} · ${peerCount} peer${peerCount > 1 ? "s" : ""}`
    : `${label} · no peers`;
};

export const switchEndpointKind = (current: Endpoint, kind: EndpointKind): Endpoint =>
  current.kind === kind
    ? current
    : { ...defaultEndpoint(kind), enabled: current.enabled };
