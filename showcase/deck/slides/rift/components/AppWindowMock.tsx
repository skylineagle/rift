import type { FC } from 'react';
import { color, font } from '../lib/theme';
import { InjectBarMock } from './InjectBarMock';
import { ProfileRowMock } from './ProfileRowMock';
import { TrafficRow } from './TrafficRow';
import { Window } from './Window';

export const AppWindowMock: FC = () => (
  <Window label="Rift">
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr' }}>
      <div style={{ borderRight: `1px solid ${color.line}`, background: color.surface }}>
        <ProfileRowMock name="gps" route="tcp-server → uart" running selected />
        <ProfileRowMock name="relay" route="udp-server → tcp" running={false} />
      </div>
      <div>
        <div
          style={{
            padding: '20px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: font.mono,
            fontSize: 22,
            color: color.fg3,
            borderBottom: `1px solid ${color.line}`,
          }}
        >
          <span style={{ color: color.fg }}>gps</span>
          <span>
            <span style={{ color: color.amber }}>A → B</span>
            {'   '}
            <span style={{ color: color.cyan }}>B → A</span>
          </span>
        </div>
        <TrafficRow time="14:02:11.482" direction="AB" size={38} payload="$GPGGA,123519,4807.038,N" />
        <TrafficRow time="14:02:11.497" direction="BA" size={4} payload="OK\r\n" />
        <TrafficRow time="14:02:12.003" direction="AB" size={38} payload="$GPRMC,123519,A,4807" />
        <TrafficRow time="14:02:13.120" direction="AB" size={6} payload="PING\r\n" injected />
        <TrafficRow time="14:02:13.141" direction="BA" size={6} payload="PONG\r\n" />
        <InjectBarMock format="hex" value="de ad be ef" targetIndex={2} />
      </div>
    </div>
  </Window>
);
