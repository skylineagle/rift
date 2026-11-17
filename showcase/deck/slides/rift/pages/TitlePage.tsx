import { MorphElement, type Page } from '@open-slide/core';
import mark from '@assets/mark.svg';
import { ParticleFlow } from '../components/ParticleFlow';
import { color, fill, font } from '../lib/theme';

export const TITLE_MARK = { left: 160, top: 170, size: 300 } as const;

export const TitlePage: Page = () => (
  <div style={fill}>
    <MorphElement id="mark">
      <img
        src={mark}
        alt=""
        style={{
          position: 'absolute',
          left: TITLE_MARK.left,
          top: TITLE_MARK.top,
          width: TITLE_MARK.size,
          height: TITLE_MARK.size,
        }}
      />
    </MorphElement>
    <div style={{ position: 'absolute', left: 520, top: 170, width: 1240 }}>
      <div style={{ fontFamily: font.mono, fontSize: 200, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}>
        rift
      </div>
      <div style={{ marginTop: 28, fontSize: 68, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
        Bridge anything that speaks bytes.
      </div>
      <div style={{ marginTop: 28, fontSize: 36, color: color.fg2 }}>
        TCP, UDP and serial. Pipe it, watch it, inject into it.
      </div>
    </div>
    <div style={{ position: 'absolute', left: 160, top: 760 }}>
      <ParticleFlow width={1600} />
    </div>
  </div>
);
