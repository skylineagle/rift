import type { FC } from "react";

import { clamp01 } from "../../kit/time";
import { MARK } from "../mark";
import { particleAt } from "../particles";

export type ParticleLayerProps = { t: number };

export const ParticleLayer: FC<ParticleLayerProps> = ({ t }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
    {MARK.map((dot, index) => {
      const particle = particleAt(t, index);
      const opacity = clamp01(particle.o);
      return opacity > 0.001 ? <circle key={index} cx={particle.x} cy={particle.y} r={Math.max(0, particle.r)} fill={dot.fill} opacity={opacity} /> : null;
    })}
  </svg>
);
