import type { FC } from 'react';
import { color, font, RADIUS } from '../lib/theme';
import { Segmented } from './Segmented';
import { SelectBox } from './SelectBox';

export type InjectBarMockProps = {
  format: string;
  value: string;
  targetIndex: number;
};

export const InjectBarMock: FC<InjectBarMockProps> = ({ format, value, targetIndex }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 24px',
      background: color.surface2,
      borderTop: `1px solid ${color.line}`,
    }}
  >
    <Segmented items={['A', '⇄', 'B']} active={targetIndex} />
    <SelectBox value={format} />
    <div
      style={{
        flex: 1,
        height: 58,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 20px',
        background: color.surface,
        border: `1px solid ${color.amber}66`,
        borderRadius: RADIUS,
        fontFamily: font.mono,
        fontSize: 28,
        color: color.fg,
      }}
    >
      <span style={{ color: color.amber, fontWeight: 700 }}>›</span>
      <span>{value}</span>
    </div>
    <div
      style={{
        width: 58,
        height: 58,
        display: 'grid',
        placeItems: 'center',
        background: color.amber,
        borderRadius: RADIUS,
        color: '#120a00',
        fontSize: 28,
        fontWeight: 700,
      }}
    >
      ↑
    </div>
  </div>
);
