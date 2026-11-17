import type { FC } from 'react';
import { color, font } from '../lib/theme';

export type TrafficRowProps = {
  time: string;
  direction: 'AB' | 'BA';
  size: number;
  payload: string;
  injected?: boolean;
  open?: boolean;
};

export const TRAFFIC_ROW_HEIGHT = 52;

export const TrafficRow: FC<TrafficRowProps> = ({ time, direction, size, payload, injected = false, open = false }) => {
  const tint = direction === 'AB' ? color.amber : color.cyan;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 44px 110px 1fr',
        alignItems: 'center',
        columnGap: 24,
        height: TRAFFIC_ROW_HEIGHT,
        padding: '0 32px',
        background: open ? color.surface3 : 'transparent',
        boxShadow: injected ? `inset 4px 0 0 ${color.amber}` : 'none',
        fontFamily: font.mono,
        fontSize: 26,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: tint, opacity: 0.75 }}>{time}</span>
      <span style={{ color: tint, textAlign: 'center' }}>{direction === 'AB' ? '→' : '←'}</span>
      <span style={{ color: color.fg3, textAlign: 'right' }}>{size} B</span>
      <span style={{ color: color.fg, overflow: 'hidden', textOverflow: 'ellipsis' }}>{payload}</span>
    </div>
  );
};
