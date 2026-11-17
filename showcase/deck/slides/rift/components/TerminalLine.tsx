import type { FC, ReactNode } from 'react';
import { color, font } from '../lib/theme';

export type TerminalLineProps = {
  children: ReactNode;
  prompt?: boolean;
  tone?: 'command' | 'amber' | 'cyan' | 'muted';
};

const toneColor = {
  command: color.fg,
  amber: color.amber,
  cyan: color.cyan,
  muted: color.fg2,
} as const;

export const TerminalLine: FC<TerminalLineProps> = ({ children, prompt = false, tone = 'command' }) => (
  <div
    style={{
      fontFamily: font.mono,
      fontSize: 30,
      lineHeight: '48px',
      whiteSpace: 'pre',
      color: toneColor[tone],
    }}
  >
    {prompt && <span style={{ color: color.fg3 }}>$ </span>}
    {children}
  </div>
);
