import type { FC } from 'react';
import { color } from '../lib/theme';

export type ParticleProps = {
  lane: 'amber' | 'cyan';
  top: number;
  size: number;
  delay: number;
  duration: number;
  travel: number;
};

export const Particle: FC<ParticleProps> = ({ lane, top, size, delay, duration, travel }) => {
  const forward = lane === 'amber';
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: forward ? 0 : travel,
        width: size,
        height: size,
        borderRadius: '50%',
        background: forward ? color.amber : color.cyan,
        opacity: 0,
        ['--travel' as string]: `${forward ? travel : -travel}px`,
        animation: `rift-flow ${duration}s linear ${-delay}s infinite`,
      }}
    />
  );
};
