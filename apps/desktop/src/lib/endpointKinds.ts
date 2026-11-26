import {
  Cable,
  Plug,
  Radio,
  Rss,
  Send,
  Server,
  Usb,
  Workflow,
  type LucideIcon,
} from "lucide-react";

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
  { kind: "websocket-client", label: "WebSocket client", icon: Cable },
  { kind: "websocket-server", label: "WebSocket server", icon: Rss },
  { kind: "rabbitmq", label: "RabbitMQ", icon: Workflow },
];

export type Protocol = "tcp" | "udp" | "ws" | "rabbitmq" | "uart";
export type Role = "client" | "server";

const ROLE_KINDS: Partial<Record<Protocol, Record<Role, EndpointKind>>> = {
  tcp: { client: "tcp-client", server: "tcp-server" },
  udp: { client: "udp-client", server: "udp-server" },
  ws: { client: "websocket-client", server: "websocket-server" },
};

export const protocolHasRoles = (protocol: Protocol) => ROLE_KINDS[protocol] !== undefined;

export const kindFor = (protocol: Protocol, role: Role): EndpointKind => {
  const roles = ROLE_KINDS[protocol];
  if (roles) return roles[role];
  return protocol === "rabbitmq" ? "rabbitmq" : "uart";
};

export const protocolOf = (kind: EndpointKind): Protocol => {
  if (kind === "uart" || kind === "rabbitmq") return kind;
  if (kind.startsWith("websocket")) return "ws";
  return kind.startsWith("tcp") ? "tcp" : "udp";
};

export const roleOf = (kind: EndpointKind): Role | null => {
  if (!protocolHasRoles(protocolOf(kind))) return null;
  return kind.endsWith("server") ? "server" : "client";
};

const DEFAULT_MESSAGE_FORMAT = {
  format: "binary",
  json_field: "data",
  json_value: "text",
} as const;

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
    case "websocket-client":
      return {
        kind,
        enabled: true,
        url: "ws://127.0.0.1:8080",
        reconnect_delay_ms: 1000,
        connect_timeout_ms: 5000,
        ...DEFAULT_MESSAGE_FORMAT,
      };
    case "websocket-server":
      return {
        kind,
        enabled: true,
        bind: "0.0.0.0:8080",
        path: null,
        max_clients: null,
        ...DEFAULT_MESSAGE_FORMAT,
      };
    case "rabbitmq":
      return {
        kind,
        enabled: true,
        url: "amqp://guest:guest@127.0.0.1:5672",
        exchange: "",
        exchange_type: "direct",
        declare_exchange: false,
        routing_key: "",
        queue: null,
        declare_queue: true,
        queue_type: "classic",
        durable: true,
        exclusive: false,
        auto_delete: false,
        binding_key: null,
        message_ttl_ms: null,
        expires_ms: null,
        max_length: null,
        max_length_bytes: null,
        dead_letter_exchange: null,
        dead_letter_routing_key: null,
        max_priority: null,
        prefetch: 50,
        persistent: false,
        content_type: null,
        reconnect_delay_ms: 1000,
        connect_timeout_ms: 5000,
      };
  }
};

const hostWithoutCredentials = (url: string) =>
  url.replace(/^[a-z]+:\/\//, "").replace(/^[^@/]*@/, "");

const shortPortName = (port: string) =>
  port.replace("/dev/tty.", "").replace("/dev/", "");

export const endpointAddress = (endpoint: Endpoint) => {
  switch (endpoint.kind) {
    case "tcp-client":
      return endpoint.address;
    case "udp-client":
      return endpoint.remote;
    case "websocket-client":
      return hostWithoutCredentials(endpoint.url);
    case "websocket-server":
      return `${endpoint.bind}${endpoint.path ?? ""}`;
    case "rabbitmq":
      return endpoint.queue || endpoint.exchange || hostWithoutCredentials(endpoint.url);
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
  if (endpoint.kind !== "tcp-server" && endpoint.kind !== "websocket-server") return label;
  return peerCount > 0
    ? `${label} · ${peerCount} peer${peerCount > 1 ? "s" : ""}`
    : `${label} · no peers`;
};

export const switchEndpointKind = (current: Endpoint, kind: EndpointKind): Endpoint =>
  current.kind === kind
    ? current
    : { ...defaultEndpoint(kind), enabled: current.enabled };
