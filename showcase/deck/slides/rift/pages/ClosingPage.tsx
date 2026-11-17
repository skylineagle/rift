import type { Page } from '@open-slide/core';
import icon from '@assets/icon.svg';
import { ParticleFlow } from '../components/ParticleFlow';
import { color, fill, font } from '../lib/theme';

export const ClosingPage: Page = () => (
  <div style={fill}>
    <img src={icon} alt="" style={{ position: 'absolute', left: 160, top: 150, width: 160, height: 160 }} />
    <div style={{ position: 'absolute', left: 160, top: 360, width: 1600 }}>
      <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
        Pipe it. Watch it. Inject into it.
      </div>
      <div style={{ marginTop: 48, fontFamily: font.mono, fontSize: 64, color: color.amber }}>
        github.com/skylineagle/rift
      </div>
    </div>
    <div style={{ position: 'absolute', left: 160, top: 780 }}>
      <ParticleFlow width={1600} />
    </div>
  </div>
);
