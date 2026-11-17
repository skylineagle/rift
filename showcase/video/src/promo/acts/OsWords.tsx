import type { FC } from "react";

import { swapIn } from "../../kit/move";
import { cue } from "../cues";
import { color, font } from "../tokens";

export type OsWordsProps = { t: number };

const NAMES = ["macOS", "Linux", "Windows"];

export const OsWords: FC<OsWordsProps> = ({ t }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 940, display: "flex", justifyContent: "center", gap: 64, fontFamily: font.ui, fontSize: 52, fontWeight: 600, color: color.fg }}>
    {NAMES.map((name, index) => {
      const look = swapIn(t, cue.profiles.os[index], cue.profiles.end);
      return (
        <span key={name} style={{ opacity: look.opacity, filter: look.filter, translate: `0 ${(1 - look.opacity) * 20}px` }}>
          {name}
        </span>
      );
    })}
  </div>
);
