import type { FC } from "react";

import { hexString } from "@/lib/format";

export type PayloadView = "ascii" | "hex";

export type PayloadTextProps = {
  bytes: Uint8Array;
  view: PayloadView;
};

const ASCII_LIMIT = 130;
const HEX_LIMIT = 56;

const CONTROL_GLYPHS: Record<number, string> = { 13: "␍", 10: "␊", 9: "␉" };

export const PayloadText: FC<PayloadTextProps> = ({ bytes, view }) => {
  if (view === "hex") {
    return <span className="text-fg-2">{hexString(bytes, HEX_LIMIT)}</span>;
  }
  const shown = bytes.slice(0, ASCII_LIMIT);
  return (
    <>
      {Array.from(shown, (byte, index) =>
        byte >= 32 && byte < 127 ? (
          String.fromCharCode(byte)
        ) : (
          <i key={index} className="text-fg-3 not-italic">
            {CONTROL_GLYPHS[byte] ?? "·"}
          </i>
        ),
      )}
      {bytes.length > shown.length && <i className="text-fg-3 not-italic">…</i>}
    </>
  );
};
