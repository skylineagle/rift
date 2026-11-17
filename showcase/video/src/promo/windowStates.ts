import { clamp01, progress } from "../kit/time";
import { cue } from "./cues";
import { INJECT_ROW, INJECT_TEXT, PROFILES, REPLY_ROW, STREAM } from "./data";
import { rowTime } from "./particles";
import type { WindowState } from "./ui/AppWindow";
import type { ShownRow } from "./ui/LogList";

const idleInject = { value: "", focused: false, caret: false, pressed: 0, bytes: 0 };

const liveProfiles = (names: readonly string[]) => names.map((name) => ({ name, status: "connected" as const, opacity: 1 }));

const streamRows = (t: number): ShownRow[] =>
  STREAM.filter((row) => t >= rowTime(row.id)).map((row) => ({ row, opacity: progress(t, rowTime(row.id), 0.08), fresh: 0 }));

const base = (t: number): WindowState => ({
  profiles: liveProfiles(PROFILES),
  selected: "gps",
  live: true,
  rows: streamRows(t),
  hex: 0,
  reveal: 0,
  events: 1200,
  inject: idleInject,
  update: 0,
  sentA: "312 B/s",
  sentB: "1.4 KB/s",
});

export const inspectState = (t: number): WindowState => {
  const rows = streamRows(Math.min(t, cue.inspect.expand - 0.01));
  return {
    ...base(t),
    rows,
    events: 1188 + rows.length,
    expandedId: t >= cue.inspect.expand ? 4 : undefined,
    reveal: progress(t, cue.inspect.expand, 0.3),
    hex: clamp01((t - cue.inspect.hex) / 0.2),
  };
};

const sendFresh = (t: number) => (t < cue.inject.send ? 0 : 1 - clamp01((t - cue.inject.send) / 1.4));

export const injectState = (t: number): WindowState => {
  const typed = Math.round(INJECT_TEXT.length * progress(t, cue.inject.typeStart, cue.inject.typeEnd - cue.inject.typeStart));
  const sent = t >= cue.inject.send;
  const press = t >= cue.inject.send - 0.08 && t < cue.inject.send + 0.08 ? 1 - Math.abs(t - cue.inject.send) / 0.08 : 0;
  const finalRows = streamRows(cue.inspect.expand - 0.01);
  const extra: ShownRow[] = [
    ...(sent ? [{ row: INJECT_ROW, opacity: 1, fresh: sendFresh(t) }] : []),
    ...(t >= cue.inject.reply ? [{ row: REPLY_ROW, opacity: progress(t, cue.inject.reply, 0.08), fresh: 0 }] : []),
  ];
  return {
    ...base(t),
    rows: [...finalRows, ...extra],
    events: 1202 + extra.length,
    inject: {
      value: sent ? "" : INJECT_TEXT.slice(0, typed),
      focused: true,
      caret: !sent || Math.floor((t - cue.inject.send) / 0.5) % 2 === 1,
      pressed: press,
      bytes: sent ? 0 : typed > 0 ? new TextEncoder().encode(INJECT_TEXT.slice(0, typed).replace(/\\r/g, "\r").replace(/\\n/g, "\n")).length : 0,
    },
  };
};

export const profilesState = (t: number): WindowState => {
  const running = t >= cue.profiles.run;
  return {
    ...base(t),
    live: running,
    rows: running ? streamRows(cue.inspect.firstRow + (t - cue.profiles.run)) : [],
    events: running ? Math.round((t - cue.profiles.run) * 4) : 0,
    sentA: running ? "312 B/s" : "0 B/s",
    sentB: running ? "1.4 KB/s" : "0 B/s",
    profiles: PROFILES.map((name, index) => ({
      name,
      status: running ? ("connected" as const) : ("idle" as const),
      opacity: progress(t, cue.profiles.rows[index], 0.2),
    })),
    update: progress(t, cue.profiles.update, 0.25),
  };
};
