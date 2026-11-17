import { type Page, Step, Steps } from '@open-slide/core';
import { EndpointCard } from '../components/EndpointCard';
import { PageFrame } from '../components/PageFrame';
import { color } from '../lib/theme';

export const EndpointsPage: Page = () => (
  <PageFrame eyebrow="Endpoints" title="Four endpoints, one URI syntax.">
    <Steps>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <Step>
          <EndpointCard kind="tcp-server" uri="tcp-server://0.0.0.0:9000" description="Listen for clients" />
        </Step>
        <Step>
          <EndpointCard kind="tcp-client" uri="tcp://host:port" description="Connect out, reconnect on drop" />
        </Step>
        <Step>
          <EndpointCard kind="udp" uri="udp://host:port?bind=0.0.0.0:7000" description="Datagrams to a peer" />
        </Step>
        <Step>
          <EndpointCard kind="uart" uri="uart:///dev/ttyUSB0?baud=115200" description="Serial, with parity and flow" />
        </Step>
      </div>
    </Steps>
    <p style={{ margin: '40px 0 0', fontSize: 32, color: color.fg2 }}>
      Options ride in the query string: reconnect_delay_ms, max_clients, parity, flow, enabled.
    </p>
  </PageFrame>
);
