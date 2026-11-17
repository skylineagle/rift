import type { FC } from 'react';
import { color, font, RADIUS } from '../lib/theme';

export type EndpointCardProps = {
  kind: string;
  uri: string;
  description: string;
};

export const EndpointCard: FC<EndpointCardProps> = ({ kind, uri, description }) => (
  <div
    style={{
      height: 216,
      padding: '28px 36px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: color.surface,
      border: `1px solid ${color.line2}`,
      borderRadius: RADIUS,
    }}
  >
    <span style={{ fontFamily: font.mono, fontSize: 28, letterSpacing: '0.08em', color: color.amber }}>{kind}</span>
    <span style={{ fontFamily: font.mono, fontSize: 30, color: color.fg, whiteSpace: 'nowrap' }}>{uri}</span>
    <span style={{ fontSize: 28, color: color.fg2 }}>{description}</span>
  </div>
);
