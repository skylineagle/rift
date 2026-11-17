import type { FC } from 'react';
import { color } from '../lib/theme';

export type StatusDotProps = { running: boolean };

export const StatusDot: FC<StatusDotProps> = ({ running }) => (
  <span
    style={{
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: running ? color.ok : color.fg3,
      flexShrink: 0,
    }}
  />
);
