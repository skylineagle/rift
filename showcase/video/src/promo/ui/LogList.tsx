import type { FC } from "react";

import type { LogRow } from "../data";
import { app } from "../layout";
import { color, font } from "../tokens";
import { DataRow } from "./DataRow";
import { HexDump } from "./HexDump";

export type ShownRow = { row: LogRow; opacity: number; fresh: number };

export type LogListProps = { rows: ShownRow[]; hex: boolean; expandedId?: number; reveal: number; height: number };

export const LogList: FC<LogListProps> = ({ rows, hex, expandedId, reveal, height }) => {
  const shown = rows.slice(-app.rowSlots);
  return (
    <div style={{ position: "relative", height, overflow: "hidden", borderTop: `1px solid ${color.line}`, fontFamily: font.mono, fontSize: 12, lineHeight: `${app.row}px`, fontVariantNumeric: "tabular-nums" }}>
      {shown.map(({ row, opacity, fresh }) => (
        <div key={row.id}>
          <DataRow row={row} hex={hex} open={row.id === expandedId} fresh={fresh} opacity={opacity} />
          {row.id === expandedId && reveal > 0 ? <HexDump text={row.text} reveal={reveal} /> : null}
        </div>
      ))}
    </div>
  );
};
