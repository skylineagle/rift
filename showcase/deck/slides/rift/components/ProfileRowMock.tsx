import type { FC } from 'react';
import { color, font } from '../lib/theme';
import { StatusDot } from './StatusDot';

export type ProfileRowMockProps = {
  name: string;
  route: string;
  running: boolean;
  selected?: boolean;
};

export const ProfileRowMock: FC<ProfileRowMockProps> = ({ name, route, running, selected = false }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '18px 24px',
      background: selected ? color.surface3 : 'transparent',
    }}
  >
    <StatusDot running={running} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 28, fontWeight: 600, color: color.fg }}>{name}</span>
      <span style={{ fontFamily: font.mono, fontSize: 20, color: color.fg3 }}>{route}</span>
    </div>
  </div>
);
