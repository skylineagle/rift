import { useCallback, type FC } from "react";

import { Hint } from "@/components/Hint";
import { useBridge } from "@/hooks/useBridge";
import { formatRate } from "@/lib/format";
import { attachParticleStream } from "@/lib/particleStream";

export type SeamStreamProps = { profileName: string };

export const SeamStream: FC<SeamStreamProps> = ({ profileName }) => {
  const bridge = useBridge(profileName);
  const attach = useCallback(
    (canvas: HTMLCanvasElement | null) =>
      canvas ? attachParticleStream(canvas, profileName) : undefined,
    [profileName],
  );
  const tip = bridge.running
    ? `A → B ${formatRate(bridge.rates.ab)} · B → A ${formatRate(bridge.rates.ba)}`
    : "Bridge stopped";

  return (
    <Hint text={tip}>
      <div className="relative hidden min-h-[60px] @[720px]:block">
        <canvas ref={attach} aria-hidden="true" className="absolute inset-0 block size-full" />
      </div>
    </Hint>
  );
};
