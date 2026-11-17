import type { FC } from 'react';
import { hexDumpLines } from '../lib/hexDump';
import { color, font } from '../lib/theme';

export type HexDumpViewProps = { bytes: number[] };

export const HexDumpView: FC<HexDumpViewProps> = ({ bytes }) => (
  <pre
    style={{
      margin: 0,
      padding: '14px 28px 14px 316px',
      background: color.surface2,
      borderTop: `1px solid ${color.line}`,
      borderBottom: `1px solid ${color.line}`,
      fontFamily: font.mono,
      fontSize: 24,
      lineHeight: '38px',
      whiteSpace: 'pre',
      color: color.fg2,
    }}
  >
    {hexDumpLines(bytes).map((line) => (
      <div key={line.offset}>
        <span style={{ color: color.fg3 }}>{line.offset}</span>
        {'  '}
        {line.hex}
        {'  '}
        <span style={{ color: color.fg3 }}>|</span>
        {line.ascii}
        <span style={{ color: color.fg3 }}>|</span>
      </div>
    ))}
  </pre>
);
