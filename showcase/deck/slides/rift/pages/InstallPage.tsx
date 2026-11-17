import { type Page, Step, Steps } from '@open-slide/core';
import { CodeLine } from '../components/CodeLine';
import { PageFrame } from '../components/PageFrame';
import { PlatformCard } from '../components/PlatformCard';
import { color } from '../lib/theme';

export const InstallPage: Page = () => (
  <PageFrame eyebrow="Install" title="Linux, macOS, Windows. Or a container.">
    <Steps>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
        <Step>
          <PlatformCard platform="Linux" desktop=".deb  .rpm  .AppImage" cli=".tar.gz" />
        </Step>
        <Step>
          <PlatformCard platform="macOS" desktop=".dmg" cli=".tar.gz" />
        </Step>
        <Step>
          <PlatformCard platform="Windows" desktop=".exe installer" cli=".zip" />
        </Step>
      </div>
    </Steps>
    <Steps>
      <Step>
        <div style={{ marginTop: 44 }}>
          <CodeLine>
            <span style={{ color: color.fg3 }}>$ </span>docker pull ghcr.io/skylineagle/rift
          </CodeLine>
          <CodeLine>
            <span style={{ color: color.fg3 }}>$ </span>cargo install --git https://github.com/skylineagle/rift rift-cli
          </CodeLine>
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 28, color: color.fg2 }}>
          macOS builds for Apple Silicon and Intel. The desktop app puts rift on your PATH, except the AppImage.
        </p>
      </Step>
    </Steps>
  </PageFrame>
);
