import type { FC } from 'react';
import { color, font } from '../lib/theme';

export const DirectionLegend: FC = () => (
  <span style={{ display: 'flex', gap: 28, fontFamily: font.mono, fontSize: 22 }}>
    <span style={{ color: color.amber }}>A → B</span>
    <span style={{ color: color.cyan }}>B → A</span>
  </span>
);
