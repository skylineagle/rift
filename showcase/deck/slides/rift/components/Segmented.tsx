import type { FC } from 'react';
import { color, font, RADIUS } from '../lib/theme';

export type SegmentedProps = {
  items: string[];
  active: number;
};

export const Segmented: FC<SegmentedProps> = ({ items, active }) => (
  <div
    style={{
      display: 'flex',
      padding: 4,
      gap: 0,
      background: color.surface2,
      border: `1px solid ${color.line2}`,
      borderRadius: RADIUS,
    }}
  >
    {items.map((item, index) => (
      <span
        key={item}
        style={{
          minWidth: 56,
          height: 48,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 6,
          background: index === active ? '#222226' : 'transparent',
          fontFamily: font.sans,
          fontSize: 24,
          fontWeight: 600,
          color: index === active ? color.fg : color.fg3,
        }}
      >
        {item}
      </span>
    ))}
  </div>
);
