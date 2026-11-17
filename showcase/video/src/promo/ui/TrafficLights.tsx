import type { FC } from "react";

const LIGHTS = ["#ff5f57", "#febc2e", "#28c840"];

export const TrafficLights: FC = () => (
  <span style={{ position: "absolute", left: 14, top: 12, display: "flex", gap: 8 }}>
    {LIGHTS.map((light) => (
      <i key={light} style={{ width: 12, height: 12, borderRadius: "50%", background: light }} />
    ))}
  </span>
);
