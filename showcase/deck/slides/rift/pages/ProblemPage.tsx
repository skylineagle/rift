import { type Page, Step, Steps } from '@open-slide/core';
import { PageFrame } from '../components/PageFrame';
import { TransportCard } from '../components/TransportCard';
import { color } from '../lib/theme';

export const ProblemPage: Page = () => (
  <PageFrame eyebrow="The problem" title="Every device speaks its own transport." morphMark>
    <Steps>
      <Step>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
          <TransportCard transport="UART" detail="A sensor on /dev/ttyUSB0" />
          <TransportCard transport="TCP" detail="A tool that wants a socket" />
          <TransportCard transport="UDP" detail="A service sending datagrams" />
        </div>
      </Step>
      <Step>
        <p style={{ margin: '64px 0 0', fontSize: 44, color: color.fg }}>
          Connecting them means one-off glue code for every pair.
        </p>
      </Step>
      <Step>
        <p style={{ margin: '24px 0 0', fontSize: 44, color: color.fg2 }}>
          And no view of what actually crossed the wire.
        </p>
      </Step>
    </Steps>
  </PageFrame>
);
