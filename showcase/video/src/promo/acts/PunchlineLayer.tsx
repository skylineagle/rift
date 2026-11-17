import type { FC } from "react";

import { Punchlines, type Card } from "../../kit/Punchlines";
import { b, cue } from "../cues";
import { color, font } from "../tokens";

export type PunchlineLayerProps = { t: number };

const CARDS: Card[] = [
  {
    lines: [
      [{ text: "Pipe", at: b(3, 1), accent: color.amber }, { text: "bytes", at: b(3, 1, 0.5) }],
      [{ text: "between", at: b(3, 2) }, { text: "any", at: b(3, 2, 0.5) }, { text: "two", at: b(3, 3) }, { text: "sides.", at: b(3, 3, 0.5) }],
    ],
    out: cue.pipe.end - 0.2,
    y: 640,
    size: 132,
  },
  {
    lines: [[{ text: "See", at: b(6, 1) }, { text: "every", at: b(6, 2) }, { text: "byte.", at: b(6, 3), accent: color.cyan }]],
    out: cue.see.end - 0.2,
    y: 620,
    size: 150,
  },
  {
    lines: [[{ text: "Inject", at: b(9, 1) }, { text: "data", at: b(9, 2) }, { text: "live.", at: b(9, 3), accent: color.amber }]],
    out: cue.injectWords.end - 0.2,
    y: 540,
    size: 150,
  },
  {
    lines: [
      [{ text: "Every", at: b(11, 1) }, { text: "profile.", at: b(11, 2) }],
      [{ text: "Every", at: b(11, 3) }, { text: "OS.", at: b(11, 3, 0.5), accent: color.cyan }],
    ],
    out: cue.every.end - 0.2,
    y: 540,
    size: 140,
  },
];

export const PunchlineLayer: FC<PunchlineLayerProps> = ({ t }) => (
  <Punchlines t={t} cards={CARDS} theme={{ font: font.ui, color: color.fg, weight: 650 }} />
);
