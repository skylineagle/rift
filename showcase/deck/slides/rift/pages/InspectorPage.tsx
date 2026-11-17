import { type Page, Step, Steps } from '@open-slide/core';
import { DirectionLegend } from '../components/DirectionLegend';
import { HexDumpView } from '../components/HexDumpView';
import { PageFrame } from '../components/PageFrame';
import { TrafficRow } from '../components/TrafficRow';
import { Window } from '../components/Window';
import { bytesFromText } from '../lib/hexDump';
import { color } from '../lib/theme';

const OPEN_FRAME = bytesFromText('$GPRMC,123519,A,4807.038,N');

export const InspectorPage: Page = () => (
  <PageFrame eyebrow="Inspect" title="See every byte, in both directions.">
    <Window label="gps · live traffic" aside={<DirectionLegend />}>
      <div style={{ padding: '8px 0' }}>
        <TrafficRow time="14:02:11.482" direction="AB" size={38} payload="$GPGGA,123519,4807.038,N,01131.000,E,1,08" />
        <TrafficRow time="14:02:11.497" direction="BA" size={4} payload="OK\r\n" />
        <TrafficRow time="14:02:12.003" direction="AB" size={26} payload="$GPRMC,123519,A,4807.038,N" open />
        <Steps>
          <Step>
            <HexDumpView bytes={OPEN_FRAME} />
          </Step>
          <Step>
            <TrafficRow time="14:02:13.120" direction="AB" size={6} payload="PING\r\n" injected />
            <TrafficRow time="14:02:13.141" direction="BA" size={6} payload="PONG\r\n" />
          </Step>
        </Steps>
      </div>
    </Window>
    <p style={{ margin: '36px 0 0', fontSize: 32, color: color.fg2 }}>
      Click a row for the hex dump. Injected data carries an amber bar.
    </p>
  </PageFrame>
);
