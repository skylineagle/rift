import type { FC, ReactNode } from 'react';
import { color, font } from '../lib/theme';

export type CodeLineProps = { children: ReactNode };

export const CodeLine: FC<CodeLineProps> = ({ children }) => (
  <div style={{ fontFamily: font.mono, fontSize: 28, lineHeight: '46px', whiteSpace: 'pre', color: color.fg }}>
    {children}
  </div>
);

export const codeKey = { color: color.fg2 } as const;
export const codeValue = { color: color.amber } as const;
export const codeHeader = { color: color.fg3 } as const;
