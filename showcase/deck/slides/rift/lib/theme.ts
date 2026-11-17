import type { CSSProperties } from 'react';

export const color = {
  bg: '#000000',
  surface: '#0b0b0c',
  surface2: '#111113',
  surface3: '#18181b',
  line: '#1e1e22',
  line2: '#2b2b30',
  fg: '#f4f4f5',
  fg2: '#a1a1aa',
  fg3: '#6e6e77',
  amber: '#f59e0b',
  cyan: '#38bdf8',
  ok: '#22c55e',
} as const;

export const font = {
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

export const RADIUS = 8;
export const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const PAGE_PADDING = 120;

export const fill: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: color.bg,
  color: color.fg,
  fontFamily: font.sans,
  overflow: 'hidden',
};
