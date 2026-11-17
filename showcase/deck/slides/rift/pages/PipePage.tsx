import { type Page, Step, Steps } from '@open-slide/core';
import { Fact } from '../components/Fact';
import { PageFrame } from '../components/PageFrame';
import { TerminalLine } from '../components/TerminalLine';
import { Window } from '../components/Window';

export const PipePage: Page = () => (
  <PageFrame eyebrow="rift pipe" title="One command. Two endpoints.">
    <Window label="terminal">
      <div style={{ padding: '24px 40px' }}>
        <Steps>
          <TerminalLine prompt>rift pipe tcp-server://0.0.0.0:9000 "uart:///dev/ttyUSB0?baud=115200"</TerminalLine>
          <Step>
            <TerminalLine tone="amber">14:02:11.482 adhoc A→B 5B  48 65 6c 6c 6f  |Hello|</TerminalLine>
            <TerminalLine tone="cyan">14:02:11.497 adhoc B→A 4B  4f 4b 0d 0a  |OK\r\n|</TerminalLine>
          </Step>
          <Step>
            <TerminalLine prompt>rift pipe udp-server://0.0.0.0:5000 tcp://example.com:7000</TerminalLine>
          </Step>
        </Steps>
      </div>
    </Window>
    <Steps>
      <Step>
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
          <Fact term="Both directions" detail="Bytes flow A to B and B to A" />
          <Fact term="Reconnects" detail="TCP backoff doubles up to 10s" />
          <Fact term="--log text|hex|json" detail="Pick how traffic prints" />
        </div>
      </Step>
    </Steps>
  </PageFrame>
);
