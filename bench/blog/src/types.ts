export type Kind = "tcp-server" | "tcp-client" | "udp-server" | "udp-client" | "uart";
export type Platform = "macos" | "linux";

export interface Point {
  rate: number | null;
  delivered: number;
  loss: number;
}

export type BlogData = Record<Platform, Record<string, Point[]>>;
