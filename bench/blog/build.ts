import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prepareShader } from "@vgpu/wgsl/prepare";

import { flowOf, loadPlatform, sweeps } from "../report/data";
import type { BlogData, Point } from "./src/types";

const [resultsDirectory = "../results", outputPath = "../BLOG.html"] = process.argv.slice(2);
const here = import.meta.dir;

const platformData = (platform: "macos" | "linux") =>
  Object.fromEntries(
    sweeps(loadPlatform(resultsDirectory, platform).matrix).map((sweep) => [
      `${sweep.source}>${sweep.destination}`,
      sweep.points.map(
        (result): Point => ({
          rate: result.rate_mbps,
          delivered: Number(flowOf(result).goodput_mbps.toFixed(3)),
          loss: Number(flowOf(result).loss_pct.toFixed(2)),
        }),
      ),
    ]),
  );

const data: BlogData = { macos: platformData("macos"), linux: platformData("linux") };
const shader = prepareShader(readFileSync(join(here, "src", "flow.wgsl"), "utf8"));

const bundle = await Bun.build({
  entrypoints: [join(here, "src", "main.ts")],
  minify: true,
  target: "browser",
  define: {
    BLOG_DATA: JSON.stringify(data),
    FLOW_SHADER: JSON.stringify(shader),
  },
});
if (!bundle.success) throw new AggregateError(bundle.logs, "bundle failed");

const script = (await bundle.outputs[0].text()).replaceAll("</script", "<\\/script");
const page = readFileSync(join(here, "src", "page.html"), "utf8").replace("/*BUNDLE*/", () => script);
writeFileSync(outputPath, page);
console.log(`wrote ${outputPath} (${(page.length / 1024).toFixed(0)} KB)`);
