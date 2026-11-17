import type { FC } from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";

import { TargetLog } from "../kit/TargetLog";
import { useTime } from "../kit/time";
import { CliScene } from "./acts/CliScene";
import { Lockup } from "./acts/Lockup";
import { OsWords } from "./acts/OsWords";
import { ParticleLayer } from "./acts/ParticleLayer";
import { PunchlineLayer } from "./acts/PunchlineLayer";
import { WindowScene } from "./acts/WindowScene";
import { cue } from "./cues";
import { inspectWindow, profilesWindow } from "./layout";
import { color, font } from "./tokens";
import { injectState, inspectState, profilesState } from "./windowStates";

export type PromoProps = { fps: number; debug: boolean };

export const Promo: FC<PromoProps> = ({ debug }) => {
  const t = useTime();
  return (
    <AbsoluteFill style={{ background: color.bg, color: color.fg, fontFamily: font.ui, overflow: "hidden" }}>
      <style>{"*{box-sizing:border-box}"}</style>
      <Audio src={staticFile("audio/promo/music.wav")} />
      <CliScene t={t} />
      <WindowScene t={t} start={cue.inspect.start} end={cue.inspect.end} placement={inspectWindow} state={inspectState} />
      <WindowScene t={t} start={cue.inject.start} end={cue.inject.end} placement={inspectWindow} state={injectState} />
      <WindowScene t={t} start={cue.profiles.start} end={cue.profiles.end} placement={profilesWindow} state={profilesState} />
      <OsWords t={t} />
      <ParticleLayer t={t} />
      <Lockup t={t} wordAt={cue.open.word} out={cue.open.end - 0.3} />
      <Lockup t={t} wordAt={cue.end.word} urlAt={cue.end.url} out={cue.end.fade} />
      <PunchlineLayer t={t} />
      {debug ? <TargetLog /> : null}
    </AbsoluteFill>
  );
};
