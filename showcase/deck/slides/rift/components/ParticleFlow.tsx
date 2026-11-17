import type { FC } from 'react';
import { color, font } from '../lib/theme';
import { Particle } from './Particle';

export type ParticleFlowProps = { width: number };

const PARTICLE_COUNT = 16;
const LANE_GAP = 84;
const DURATION_SECONDS = 9;

const sizeAt = (index: number) => 10 + (index % 5) * 2;
const offsetAt = (index: number) => [0, 0, -22, 0, 22][index % 5];

const keyframes = `
@keyframes rift-flow {
  0% { transform: translateX(0); opacity: 0; }
  8% { opacity: 1; }
  92% { opacity: 1; }
  100% { transform: translateX(var(--travel)); opacity: 0; }
}`;

export const ParticleFlow: FC<ParticleFlowProps> = ({ width }) => (
  <div style={{ position: 'relative', width, height: LANE_GAP * 2 + 60 }}>
    <style>{keyframes}</style>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 1, background: color.line2 }} />
    <div
      style={{ position: 'absolute', left: 0, right: 0, top: 30 + LANE_GAP, height: 1, background: color.line2 }}
    />
    <span style={{ position: 'absolute', left: 0, top: -4, fontFamily: font.mono, fontSize: 22, color: color.fg3 }}>A</span>
    <span style={{ position: 'absolute', right: 0, top: -4, fontFamily: font.mono, fontSize: 22, color: color.fg3 }}>B</span>
    {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
      <Particle
        key={`amber-${index}`}
        lane="amber"
        top={30 - sizeAt(index) / 2 + offsetAt(index)}
        size={sizeAt(index)}
        delay={(index * DURATION_SECONDS) / PARTICLE_COUNT}
        duration={DURATION_SECONDS}
        travel={width}
      />
    ))}
    {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
      <Particle
        key={`cyan-${index}`}
        lane="cyan"
        top={30 + LANE_GAP - sizeAt(index) / 2 + offsetAt(index + 2)}
        size={sizeAt(index)}
        delay={(index * DURATION_SECONDS) / PARTICLE_COUNT + 0.4}
        duration={DURATION_SECONDS + 1}
        travel={width}
      />
    ))}
  </div>
);
