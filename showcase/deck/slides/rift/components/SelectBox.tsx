import type { FC } from 'react';
import { color, font, RADIUS } from '../lib/theme';

export type SelectBoxProps = { value: string };

export const SelectBox: FC<SelectBoxProps> = ({ value }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      width: 140,
      height: 58,
      padding: '0 16px',
      background: color.surface,
      border: `1px solid ${color.line2}`,
      borderRadius: RADIUS,
      fontFamily: font.mono,
      fontSize: 24,
      color: color.fg,
    }}
  >
    <span>{value}</span>
    <span style={{ color: color.fg3, fontSize: 18 }}>⌄</span>
  </div>
);
