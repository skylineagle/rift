import { type Page, Step, Steps } from '@open-slide/core';
import { CodeLine, codeHeader, codeKey, codeValue } from '../components/CodeLine';
import { PageFrame } from '../components/PageFrame';
import { TerminalLine } from '../components/TerminalLine';
import { Window } from '../components/Window';
import { color } from '../lib/theme';

export const ProfilesPage: Page = () => (
  <PageFrame eyebrow="Profiles" title="Save it once. Run it by name.">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
      <Steps>
        <Step>
          <Window label="terminal">
            <div style={{ padding: '20px 32px' }}>
              <TerminalLine prompt>rift profile add gps \</TerminalLine>
              <TerminalLine>{'    tcp-server://0.0.0.0:9000 \\'}</TerminalLine>
              <TerminalLine>{'    "uart:///dev/ttyUSB0?baud=9600"'}</TerminalLine>
              <TerminalLine prompt>rift profile list</TerminalLine>
              <TerminalLine prompt>rift run -c rift.toml gps</TerminalLine>
              <TerminalLine prompt>rift run -c rift.toml --all</TerminalLine>
            </div>
          </Window>
        </Step>
        <Step>
          <Window label="rift.toml">
            <div style={{ padding: '20px 32px' }}>
              <CodeLine>
                <span style={codeHeader}>[[profile]]</span>
              </CodeLine>
              <CodeLine>
                <span style={codeKey}>name</span> = <span style={codeValue}>"gps"</span>
              </CodeLine>
              <CodeLine>
                <span style={codeKey}>a</span> = {'{ '}
                <span style={codeKey}>kind</span> = <span style={codeValue}>"tcp-server"</span>,
              </CodeLine>
              <CodeLine>
                {'    '}
                <span style={codeKey}>bind</span> = <span style={codeValue}>"0.0.0.0:9000"</span> {'}'}
              </CodeLine>
              <CodeLine>
                <span style={codeKey}>b</span> = {'{ '}
                <span style={codeKey}>kind</span> = <span style={codeValue}>"uart"</span>,
              </CodeLine>
              <CodeLine>
                {'    '}
                <span style={codeKey}>port</span> = <span style={codeValue}>"/dev/ttyUSB0"</span>,
              </CodeLine>
              <CodeLine>
                {'    '}
                <span style={codeKey}>baud_rate</span> = <span style={codeValue}>9600</span> {'}'}
              </CodeLine>
            </div>
          </Window>
        </Step>
      </Steps>
    </div>
    <Steps>
      <Step>
        <p style={{ margin: '40px 0 0', fontSize: 32, color: color.fg2 }}>
          The desktop app reads the same file, so profiles you add in the CLI show up there.
        </p>
      </Step>
    </Steps>
  </PageFrame>
);
