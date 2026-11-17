import { ArrowUpCircle } from "lucide-react";
import type { FC } from "react";

import { color } from "../tokens";

export type UpdateReadyPillProps = { version: string; opacity: number };

export const UpdateReadyPill: FC<UpdateReadyPillProps> = ({ version, opacity }) => (
  <span
    style={{
      display: "inline-flex",
      height: 24,
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      border: `1px solid ${color.amberLine}`,
      background: color.amberSoft,
      color: color.amberText,
      padding: "0 10px",
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: "nowrap",
      opacity,
      filter: opacity < 1 ? `blur(${(1 - opacity) * 6}px)` : undefined,
    }}
  >
    <ArrowUpCircle size={14} />
    Rift {version} · Restart to update
  </span>
);
