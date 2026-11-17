import { cue, DURATION, GRID } from "../src/promo/cues";

const rows: [string, number, number][] = [
  ["Opening: 14 particles gather into the mark, lockup with \"rift\"", 0, cue.open.end],
  ["Punchline: Pipe bytes / between any two sides.", cue.pipe.start, cue.pipe.end],
  ["CLI: rift pipe tcp-server -> uart, log lines, particle streams A->B amber, B->A cyan", cue.cli.start, cue.cli.end],
  ["Punchline: See every byte.", cue.see.start, cue.see.end],
  ["Inspector: particles drop into 14 DataRows, row expands to HexDump, view flips to hex", cue.inspect.start, cue.inspect.end],
  ["Punchline: Inject data live.", cue.injectWords.start, cue.injectWords.end],
  ["InjectBar: type $PUBX,00*33\\r\\n, send on beat 3, GPS replies on beat 4", cue.inject.start, cue.inject.end],
  ["Punchline: Every profile. / Every OS.", cue.every.start, cue.every.end],
  ["Profiles: gps, modem, imu land, all go live, macOS Linux Windows, update pill", cue.profiles.start, cue.profiles.end],
  ["Ending: status dots become particles, mark lockup, github.com/skylineagle/rift, fade", cue.end.start, DURATION],
];

const bar = (seconds: number) => 1 + (seconds - GRID.firstBeat) / (GRID.beatsPerBar * 60 / GRID.bpm);
console.log(`| Bars | Seconds | Scene |\n| --- | --- | --- |`);
for (const [scene, start, end] of rows) {
  console.log(`| ${bar(start)}–${bar(end)} | ${start.toFixed(1)}–${end.toFixed(1)} | ${scene} |`);
}
