import { Easing } from "remotion";
import type { FC } from "react";

import { clamp01 } from "../../kit/time";
import { lockup } from "../layout";
import { color, font } from "../tokens";

export type LockupProps = { t: number; wordAt: number; urlAt?: number; out: number };

const land = Easing.bezier(0.22, 1, 0.36, 1);

const reveal = (t: number, start: number) => land(clamp01((t - start) / 0.35));

export const Lockup: FC<LockupProps> = ({ t, wordAt, urlAt, out }) => {
  if (t < wordAt - 0.05 || t > out + 0.4) return null;
  const leave = clamp01((t - out) / 0.35);
  const letters = Array.from("rift");
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - leave, filter: leave > 0 ? `blur(${leave * 12}px)` : undefined }}>
      <div
        data-target="wordmark"
        style={{ position: "absolute", left: lockup.wordX, top: lockup.markY, translate: "0 -54%", display: "flex", fontFamily: font.ui, fontSize: lockup.wordSize, fontWeight: 650, letterSpacing: "-0.04em", lineHeight: 1, color: color.fg }}
      >
        {letters.map((letter, index) => {
          const u = reveal(t, wordAt + index * 0.0625);
          return (
            <span key={index} style={{ opacity: u, filter: u < 1 ? `blur(${(1 - u) * 16}px)` : undefined, translate: `${(1 - u) * -28}px 0` }}>
              {letter}
            </span>
          );
        })}
      </div>
      {urlAt === undefined ? null : (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: lockup.urlY,
            textAlign: "center",
            fontFamily: font.mono,
            fontSize: 44,
            color: color.fg2,
            opacity: reveal(t, urlAt),
            filter: reveal(t, urlAt) < 1 ? `blur(${(1 - reveal(t, urlAt)) * 12}px)` : undefined,
            translate: `0 ${(1 - reveal(t, urlAt)) * 24}px`,
          }}
        >
          github.com/<span style={{ color: color.fg }}>skylineagle/rift</span>
        </div>
      )}
    </div>
  );
};
