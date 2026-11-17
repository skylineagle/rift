import type { FC } from "react";

import { color } from "../tokens";

export type PayloadTextProps = { text: string; hex: boolean };

const GLYPHS: Record<string, string> = { "\r": "␍", "\n": "␊" };

const hexString = (text: string) =>
  Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");

export const PayloadText: FC<PayloadTextProps> = ({ text, hex }) =>
  hex ? (
    <span style={{ color: color.fg2 }}>{hexString(text)}</span>
  ) : (
    <>
      {Array.from(text, (char, index) =>
        GLYPHS[char] ? (
          <i key={index} style={{ fontStyle: "normal", color: color.fg3 }}>
            {GLYPHS[char]}
          </i>
        ) : (
          char
        ),
      )}
    </>
  );
