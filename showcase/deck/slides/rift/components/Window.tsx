import type { FC, ReactNode } from 'react';
import { color, font, RADIUS } from '../lib/theme';

export type WindowProps = {
  label: string;
  children: ReactNode;
  aside?: ReactNode;
};

export const Window: FC<WindowProps> = ({ label, children, aside }) => (
  <div
    style={{
      background: color.surface,
      border: `1px solid ${color.line2}`,
      borderRadius: RADIUS,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        padding: '0 24px',
        background: color.surface2,
        borderBottom: `1px solid ${color.line}`,
        fontFamily: font.mono,
        fontSize: 22,
        color: color.fg3,
      }}
    >
      <span>{label}</span>
      {aside}
    </div>
    {children}
  </div>
);
