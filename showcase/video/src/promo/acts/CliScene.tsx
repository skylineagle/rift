import type { FC } from "react";

import { swapIn } from "../../kit/move";
import { progress } from "../../kit/time";
import { b, cue } from "../cues";
import { CLI_LINES, COMMAND } from "../data";
import { cli } from "../layout";
import { color, font } from "../tokens";

export type CliSceneProps = { t: number };

const LINE_TIMES = [cue.cli.enter, b(5, 1), b(5, 1, 0.5), b(5, 2), b(5, 2, 0.5), b(5, 3), b(5, 3, 0.5), b(5, 4)];

export const CliScene: FC<CliSceneProps> = ({ t }) => {
  const look = swapIn(t, cue.cli.start, cue.cli.end);
  if (!look.visible) return null;
  const typed = Math.round(COMMAND.length * progress(t, cue.cli.start + 0.1, cue.cli.typeEnd - cue.cli.start - 0.1));
  const { terminal, streams } = cli;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: look.opacity, filter: look.filter }}>
      <div
        style={{
          position: "absolute",
          left: terminal.x,
          top: terminal.y,
          width: terminal.w,
          height: terminal.h,
          boxSizing: "border-box",
          borderRadius: 16,
          border: `2px solid ${color.line}`,
          background: color.surface2,
          padding: "40px 48px",
          fontFamily: font.mono,
          fontSize: 21,
          lineHeight: "50px",
          whiteSpace: "pre",
          overflow: "hidden",
          color: color.fg2,
        }}
      >
        <div style={{ color: color.fg, fontSize: 26 }}>
          <span style={{ color: color.fg3 }}>$ </span>
          {COMMAND.slice(0, typed)}
          {t < cue.cli.enter ? <i style={{ display: "inline-block", width: 14, height: 30, verticalAlign: "-5px", background: color.fg }} /> : null}
        </div>
        {CLI_LINES.map((line, index) => {
          const u = progress(t, LINE_TIMES[index], 0.12);
          return (
            <div key={index} style={{ opacity: u, translate: `0 ${(1 - u) * 8}px` }}>
              {line}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: streams.from - 30, top: streams.labelY, fontFamily: font.mono, fontSize: 30, color: color.amber }}>
        A <span style={{ color: color.fg }}>tcp-server :9000</span>
      </div>
      <div style={{ position: "absolute", right: 1920 - streams.to - 30, top: streams.labelY, fontFamily: font.mono, fontSize: 30, color: color.cyan }}>
        <span style={{ color: color.fg }}>uart ttyUSB0</span> B
      </div>
    </div>
  );
};
