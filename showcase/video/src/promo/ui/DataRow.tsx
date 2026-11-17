import { ArrowLeft, ArrowRight } from "lucide-react";
import type { FC } from "react";

import type { LogRow } from "../data";
import { app } from "../layout";
import { color } from "../tokens";
import { PayloadText } from "./PayloadText";

export type DataRowProps = { row: LogRow; hex: boolean; open: boolean; fresh: number; opacity: number };

export const DataRow: FC<DataRowProps> = ({ row, hex, open, fresh, opacity }) => {
  const sideA = row.injected ? row.direction === "BA" : row.direction === "AB";
  const tint = sideA ? color.amber : color.cyan;
  const Arrow = row.direction === "AB" ? ArrowRight : ArrowLeft;
  const inset = row.injected ? `inset 2px 0 0 ${color.amber}` : undefined;
  return (
    <div
      data-target={`row-${row.id}`}
      style={{
        display: "grid",
        height: app.row,
        gridTemplateColumns: "90px 16px 46px minmax(0,1fr)",
        alignItems: "center",
        columnGap: 12,
        padding: "0 14px",
        whiteSpace: "nowrap",
        boxShadow: inset,
        background: open ? color.surface3 : fresh > 0 ? `rgba(245, 158, 11, ${0.14 * fresh})` : undefined,
        opacity,
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", color: tint, opacity: 0.75 }}>{row.time}</span>
      <span style={{ display: "grid", placeItems: "center", color: tint }}>
        <Arrow size={12} />
      </span>
      <span style={{ textAlign: "right", color: color.fg3 }}>{new TextEncoder().encode(row.text).length} B</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        <PayloadText text={row.text} hex={hex} />
      </span>
    </div>
  );
};
