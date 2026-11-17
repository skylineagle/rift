import { type Page, Step, Steps } from '@open-slide/core';
import { CodeLine } from '../components/CodeLine';
import { InjectBarMock } from '../components/InjectBarMock';
import { PageFrame } from '../components/PageFrame';
import { TrafficRow } from '../components/TrafficRow';
import { Window } from '../components/Window';
import { color, font } from '../lib/theme';

export const InjectPage: Page = () => (
  <PageFrame eyebrow="Inject" title="Type bytes. Send them live.">
    <Window label="gps · live traffic">
      <Steps>
        <Step>
          <InjectBarMock format="hex" value="de ad be ef" targetIndex={2} />
        </Step>
        <Step>
          <div style={{ padding: '8px 0', borderTop: `1px solid ${color.line}` }}>
            <TrafficRow time="14:02:13.120" direction="AB" size={4} payload="de ad be ef" injected />
            <TrafficRow time="14:02:13.141" direction="BA" size={6} payload="PONG\r\n" />
          </div>
        </Step>
      </Steps>
    </Window>
    <Steps>
      <Step>
        <div style={{ marginTop: 48 }}>
          <div style={{ fontFamily: font.mono, fontSize: 24, letterSpacing: '0.12em', color: color.fg3 }}>
            CLI: LINES ON STDIN WHILE RIFT RUNS
          </div>
          <CodeLine>a hex de ad be ef</CodeLine>
          <CodeLine>gps:both text hello\r\n</CodeLine>
          <CodeLine>b file ./frame.bin</CodeLine>
        </div>
      </Step>
    </Steps>
  </PageFrame>
);
