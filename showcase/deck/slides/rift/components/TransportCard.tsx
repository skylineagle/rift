import type { FC } from 'react';
import { color, font, RADIUS } from '../lib/theme';

export type TransportCardProps = {
  transport: string;
  detail: string;
};

export const TransportCard: FC<TransportCardProps> = ({ transport, detail }) => (
  <div
    style={{
      height: 240,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: color.surface,
      border: `2px dashed ${color.line2}`,
      borderRadius: RADIUS,
    }}
  >
    <span style={{ fontFamily: font.mono, fontSize: 56, fontWeight: 700, color: color.fg }}>{transport}</span>
    <span style={{ fontSize: 32, color: color.fg2 }}>{detail}</span>
  </div>
);
