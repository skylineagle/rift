import { type Page, Step, Steps } from '@open-slide/core';
import { AppWindowMock } from '../components/AppWindowMock';
import { Fact } from '../components/Fact';
import { PageFrame } from '../components/PageFrame';

export const DesktopPage: Page = () => (
  <PageFrame eyebrow="Desktop app" title="Prefer a window? It is all there.">
    <div style={{ display: 'grid', gridTemplateColumns: '1090px 1fr', gap: 56 }}>
      <AppWindowMock />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 44, paddingTop: 12 }}>
        <Steps>
          <Step>
            <Fact term="Profiles" detail="Same config file as the CLI" />
          </Step>
          <Step>
            <Fact term="Live traffic" detail="Hex dumps, both directions" />
          </Step>
          <Step>
            <Fact term="Inject" detail="Send text, hex, bin or files" />
          </Step>
          <Step>
            <Fact term="Self-updates" detail="Built in" />
          </Step>
        </Steps>
      </div>
    </div>
  </PageFrame>
);
