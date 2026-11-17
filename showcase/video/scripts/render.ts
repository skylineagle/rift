import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const [composition, name, version] = args;
const duration = Number(flag("--duration"));
const posterSeconds = Number(flag("--poster") ?? duration / 2);
const fps = 30;
const subframes = 4;
if (!composition || !name || !version || !duration) throw new Error("Usage: bun scripts/render.ts <CompositionId> <name> <version> --duration <s> [--poster <s>]");

const root = resolve(import.meta.dirname, "..");
const out = join(root, "out", name, version);
mkdirSync(out, { recursive: true });
const run = (command: string, list: string[]) => execFileSync(command, list, { cwd: root, stdio: "inherit" });
const ffmpeg = execFileSync("uv", ["run", "--quiet", "--with", "imageio-ffmpeg", "python3", "-c", "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();

const master = join(out, "master.mp4");
const audio = join(out, "audio.wav");
const blurred = join(out, "blurred.mov");

run("npx", ["remotion", "render", "src/index.ts", composition, master, "--props", JSON.stringify({ fps: fps * subframes, debug: false }), "--codec", "h264", "--crf", "8", "--pixel-format", "yuv444p", "--image-format", "png", "--muted", "--concurrency", "8", "--log", "error"]);
run("npx", ["remotion", "render", "src/index.ts", composition, audio, "--props", JSON.stringify({ fps, debug: false }), "--codec", "wav", "--log", "error"]);

run(ffmpeg, [
  "-v", "error", "-y", "-i", master,
  "-vf", `tmix=frames=${subframes}:weights='1 1 1 1',select='not(mod(n+1\\,${subframes}))',setpts=N/(${fps}*TB),scale=in_range=tv:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv444p10le`,
  "-r", String(fps), "-c:v", "prores_ks", "-profile:v", "4444", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
  blurred,
]);

const h264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", "-movflags", "+faststart"];

run(ffmpeg, ["-v", "error", "-y", "-i", blurred, "-i", audio, ...h264, "-c:a", "aac", "-b:a", "256k", "-shortest", join(out, `${name}.mp4`)]);
run(ffmpeg, ["-v", "error", "-y", "-ss", String(posterSeconds), "-i", blurred, "-frames:v", "1", "-q:v", "2", join(out, "poster.jpg")]);

rmSync(master);
rmSync(blurred);
rmSync(audio);
for (const file of [`${name}.mp4`, "poster.jpg"]) {
  console.log(`${file}: ${(statSync(join(out, file)).size / 1e6).toFixed(1)} MB`);
}
