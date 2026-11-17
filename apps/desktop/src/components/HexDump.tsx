import type { FC } from "react";

import { hexDumpLines } from "@/lib/format";

export type HexDumpProps = { bytes: Uint8Array };

export const DUMP_LINE_HEIGHT = 18;
export const DUMP_PADDING = 16;

export const dumpHeight = (byteCount: number) =>
  Math.ceil(byteCount / 16) * DUMP_LINE_HEIGHT + DUMP_PADDING;

export const HexDump: FC<HexDumpProps> = ({ bytes }) => (
  <pre
    data-selectable
    style={{ height: dumpHeight(bytes.length) }}
    className="m-0 overflow-x-auto border-y border-line bg-surface-2 py-[7px] pr-3.5 pl-[132px] font-mono text-[11.5px] leading-[18px] whitespace-pre text-fg-2"
  >
    {hexDumpLines(bytes).map((line) => (
      <div key={line.offset}>
        <span className="text-fg-3">{line.offset}</span>
        {"  "}
        {line.hex}
        {"  "}
        <span className="text-fg-3">|</span>
        {line.ascii}
        <span className="text-fg-3">|</span>
      </div>
    ))}
  </pre>
);
