import type { FC } from 'react';
import { color, font, RADIUS } from '../lib/theme';

export type PlatformCardProps = {
  platform: string;
  desktop: string;
  cli: string;
};

export const PlatformCard: FC<PlatformCardProps> = ({ platform, desktop, cli }) => (
  <div
    style={{
      padding: 36,
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
      background: color.surface,
      border: `1px solid ${color.line2}`,
      borderRadius: RADIUS,
    }}
  >
    <span style={{ fontSize: 48, fontWeight: 700 }}>{platform}</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 24, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.fg3 }}>
        Desktop app
      </span>
      <span style={{ fontFamily: font.mono, fontSize: 28, color: color.amber }}>{desktop}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 24, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.fg3 }}>
        CLI only
      </span>
      <span style={{ fontFamily: font.mono, fontSize: 28, color: color.cyan }}>{cli}</span>
    </div>
  </div>
);
