import type { FC } from "react";
import { Composition } from "remotion";

import { DURATION } from "./promo/cues";
import { Promo, type PromoProps } from "./promo/Promo";

const defaults: PromoProps = { fps: 30, debug: false };

export const Root: FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    width={1920}
    height={1080}
    fps={defaults.fps}
    durationInFrames={Math.round(DURATION * defaults.fps)}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({ fps: props.fps, durationInFrames: Math.round(DURATION * props.fps) })}
  />
);
