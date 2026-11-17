import type { FC } from "react";

import { color, font } from "../tokens";

export type HexDumpProps = { text: string; reveal: number };

const LINE = 18;

const lines = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  const result: { offset: string; hex: string; ascii: string }[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = Array.from(bytes.slice(offset, offset + 16));
    result.push({
      offset: offset.toString(16).padStart(4, "0"),
      hex: chunk.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ").padEnd(47, " "),
      ascii: chunk.map((byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".")).join(""),
    });
  }
  return result;
};

export const dumpHeight = (text: string) => Math.ceil(new TextEncoder().encode(text).length / 16) * LINE + 16;

export const HexDump: FC<HexDumpProps> = ({ text, reveal }) => (
  <pre
    style={{
      margin: 0,
      height: dumpHeight(text) * reveal,
      overflow: "hidden",
      borderTop: `1px solid ${color.line}`,
      borderBottom: `1px solid ${color.line}`,
      background: color.surface2,
      padding: "7px 14px 0 132px",
      fontFamily: font.mono,
      fontSize: 11.5,
      lineHeight: `${LINE}px`,
      whiteSpace: "pre",
      color: color.fg2,
    }}
  >
    {lines(text).map((line) => (
      <div key={line.offset}>
        <span style={{ color: color.fg3 }}>{line.offset}</span>
        {"  "}
        {line.hex}
        {"  "}
        <span style={{ color: color.fg3 }}>|</span>
        {line.ascii}
        <span style={{ color: color.fg3 }}>|</span>
      </div>
    ))}
  </pre>
);
