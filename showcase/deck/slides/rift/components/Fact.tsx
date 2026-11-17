import type { FC } from 'react';
import { color, font } from '../lib/theme';

export type FactProps = {
  term: string;
  detail: string;
};

export const Fact: FC<FactProps> = ({ term, detail }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span style={{ fontFamily: font.mono, fontSize: 30, color: color.fg }}>{term}</span>
    <span style={{ fontSize: 28, color: color.fg2 }}>{detail}</span>
  </div>
);
