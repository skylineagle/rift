export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass?: number;
  clamp?: boolean;
};

export const step = (t: number, { stiffness, damping, mass = 1, clamp = false }: SpringConfig) => {
  if (t <= 0) return 0;
  const natural = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = Math.exp(-zeta * natural * t);
  const value =
    zeta < 1
      ? 1 - decay * (Math.cos(natural * Math.sqrt(1 - zeta * zeta) * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(natural * Math.sqrt(1 - zeta * zeta) * t))
      : zeta === 1
        ? 1 - Math.exp(-natural * t) * (1 + natural * t)
        : 1 - decay * (Math.cosh(natural * Math.sqrt(zeta * zeta - 1) * t) + (zeta / Math.sqrt(zeta * zeta - 1)) * Math.sinh(natural * Math.sqrt(zeta * zeta - 1) * t));
  return clamp ? Math.min(value, 1) : value;
};

export type Key = readonly [time: number, value: number];

export const track = (t: number, keys: readonly Key[], config: SpringConfig) => {
  let value = keys[0][1];
  for (let index = 1; index < keys.length; index++) {
    value += (keys[index][1] - keys[index - 1][1]) * step(t - keys[index][0], config);
  }
  return value;
};

export const critical = (response: number): SpringConfig => ({
  stiffness: response * response,
  damping: 2 * response,
});
