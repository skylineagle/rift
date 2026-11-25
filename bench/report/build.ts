import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadPlatform, type PlatformResults } from "./data";
import { shell } from "./page";
import { findings, method, reproduce, summaryTiles } from "./narrative";
import {
  bidirectionalTable,
  cpuLoadChart,
  frameChart,
  frameMemoryChart,
  fullTable,
  latencyHeatmap,
  latencyLoadChart,
  logBars,
  lossChart,
  losslessHeatmap,
  memoryLoadChart,
  peakMemoryBars,
  saturationHeatmap,
  collapseChart,
  soakCharts,
  sweepSmallMultiples,
} from "./sections";

const resultsDirectory = process.argv[2] ?? join(import.meta.dir, "..", "results");
const output = process.argv[3] ?? join(import.meta.dir, "..", "REPORT.html");

const platforms = (["macos", "linux"] as const)
  .map((platform) => loadPlatform(resultsDirectory, platform))
  .filter((results) => results.matrix.length > 0);

const both = (render: (results: PlatformResults) => string) => `<div class="grid2">${platforms.map(render).join("")}</div>`;
const each = (render: (results: PlatformResults) => string) => platforms.map(render).join("");
const linux = platforms.find((results) => results.platform === "linux");

const sections = [
  ["summary", "Summary"],
  ["method", "What was tested"],
  ["throughput", "Throughput"],
  ["integrity", "Overload and data integrity"],
  ["latency", "Latency"],
  ["resources", "Memory and CPU"],
  ["frames", "Frame size and logging"],
  ["soak", "Longevity soak"],
  ["recommendations", "Recommendations"],
  ["data", "Raw results"],
  ["reproduce", "Reproduce"],
];

const body = `
<h1>Rift throughput, latency, memory and longevity benchmark</h1>
<p class="meta">rift 0.2.1 (commit b7aa0c8) · macOS: Apple M3 Pro, 11 cores, 18 GB, macOS 27.2 · Linux: AMD EPYC 9354P KVM guest, 2 vCPUs, 8 GB, Ubuntu 24.04, kernel 6.8 · loopback only, harness on the same machine · November 2026</p>
${draftBanner()}
<nav class="toc">${sections.map(([id, title]) => `<a href="#${id}">${title}</a>`).join("")}</nav>

<h2 id="summary">Summary</h2>
${summaryTiles(platforms)}
${findings(platforms)}

<h2 id="method">What was tested</h2>
${method(platforms)}

<h2 id="throughput">Throughput</h2>
<p>Each cell is one direction: data enters Rift through the row's side type and leaves through the column's. The harness raised the offered rate step by step (1, 10, 50, 100, 200, 300, 400, 600, 800, 1200 MB/s, then unthrottled; serial rows start at 0.0115 MB/s, the 115200 baud equivalent) for 4 s per step. <strong>Clean</strong> means under 0.1% of frames lost and none corrupted. Hover a cell for details.</p>
${each(losslessHeatmap)}
${each(saturationHeatmap)}
<h3>Bidirectional, both directions unthrottled at once</h3>
${each((results) => `<p class="muted">${results.platform === "macos" ? "macOS" : "Linux"}</p>${bidirectionalTable(results)}`)}
<h3>Delivered vs offered, every direction</h3>
<p>The dashed line is what was offered. Where the blue line falls below it, Rift is dropping data.</p>
${each((results) => `<p class="muted">${results.platform === "macos" ? "macOS" : "Linux"}</p>${sweepSmallMultiples(results)}`)}

<h2 id="integrity">Overload and data integrity</h2>
${both((results) => lossChart(results))}
${linux ? lossChart(linux, true) : ""}

<h2 id="latency">Latency</h2>
<p>One-way latency is measured per frame, from the harness <code>write()</code> to the harness reading it on the far side, on one clock. It includes both kernel hops, so compare against the direct loopback baseline in the method section.</p>
${both((results) => latencyHeatmap(results, "p50_us"))}
${both((results) => latencyHeatmap(results, "p99_us"))}
${both((results) => latencyLoadChart(results))}
${linux ? latencyLoadChart(linux, true) : ""}

<h2 id="resources">Memory and CPU</h2>
<p>Resident memory (RSS) and CPU of the <code>rift</code> process, sampled every 100 ms by the harness.</p>
${both((results) => memoryLoadChart(results))}
${linux ? memoryLoadChart(linux, true) : ""}
${both(cpuLoadChart)}
${both(peakMemoryBars)}

<h2 id="frames">Frame size and logging</h2>
<p>Frame size is the harness write unit. For UDP sources it is the datagram size, and Rift forwards one datagram per read. For TCP sources Rift re-chunks into reads of up to 4096 bytes, whatever the frame size.</p>
${both((results) => frameChart(results, null))}
${both(frameMemoryChart)}
${both(logBars)}

<h2 id="soak">Longevity soak</h2>
${soakIntro()}
${each(soakCharts)}
<h3>Overload run: the same soak at 241 MB/s</h3>
<p>The first soak attempt offered twice the load: 80 MB/s per TCP direction and 20 MB/s per UDP direction, about 241 MB/s in one process. For the first 4 minutes it delivered everything with slowly growing loss. A burst of host load then pushed it over (an OrbStack restart and a browser download). Delivery fell to 15 to 90 MB/s and <strong>never recovered</strong> once the host was quiet again, while Rift's CPU went <em>up</em>. Once queues overflow, Rift spends its cycles on drops, lagged broadcast receivers and per-chunk event work, which is classic congestion collapse.</p>
${each((results) => collapseChart(results.overload, `Offered vs delivered, 241 MB/s soak, ${results.platform === "macos" ? "macOS" : "Linux"}`))}

<h2 id="recommendations">Recommendations</h2>
${recommendationsBlock()}

<h2 id="data">Raw results</h2>
${each((results) => `<details><summary>${results.platform === "macos" ? "macOS" : "Linux"}: all ${results.matrix.length} matrix runs</summary>${fullTable(results)}</details>`)}

<h2 id="reproduce">Reproduce</h2>
${reproduce()}
`;

function draftBanner() {
  const pending = [
    !linux ? "Linux suites (UART included)" : "",
    platforms.some((results) => !results.soak) ? "the soak is still running, charts show data so far" : "",
  ].filter(Boolean);
  return pending.length === 0
    ? ""
    : `<div class="finding warn"><h4><span class="tag warn">in progress</span>This page is updated as runs finish</h4><p>Pending: ${pending.join("; ")}.</p></div>`;
}

function soakIntro() {
  return platforms
    .map((results) => {
      if (!results.soak && results.ticks.length === 0) return "";
      const last = results.ticks.at(-1);
      return `<p class="muted">${results.platform}: ${last ? `${(last.elapsed_s / 60).toFixed(0)} minutes recorded` : ""}</p>`;
    })
    .join("");
}

function recommendationsBlock() {
  return `<ol>
<li><strong>Apply backpressure for stream-to-stream bridges instead of dropping.</strong> <code>SideHandle::deliver</code> uses <code>try_send</code> into a 256-slot channel and drops the chunk when it is full (<code>crates/rift-core/src/bridge.rs</code>). For TCP and UART sources, awaiting <code>send</code> would push back through the kernel to the sender, and TCP would flow-control on its own. Keep dropping only for datagram sources, or make it a per-side option such as <code>overflow=drop|block</code>.</li>
<li><strong>Do not drop into the middle of a TCP stream.</strong> A dropped 4 KB chunk is not frame-aligned, so the receiver gets a stream with a hole in it, and every protocol on top breaks until it resyncs. If dropping stays, disconnect the TCP peer on overflow instead of silently splicing the stream.</li>
<li><strong>Make queue depth configurable and bigger by default.</strong> 256 chunks of 4 KB is about 1 MB, or 5 ms of slack at 200 MB/s. A short scheduler stall is enough to lose data, which is why loss appears at rates far below the ceiling. Size the queue in bytes, not chunks.</li>
<li><strong>Skip the per-chunk event copies when nobody needs them.</strong> Every chunk builds a <code>Received</code> and a <code>Forwarded</code> event, each copying the payload into a fresh <code>Vec</code> (<code>event.rs</code>), even with <code>--quiet</code>. Store <code>Bytes</code> in the event, or skip data events when no subscriber wants them. This is most of the about one core per 100 MB/s.</li>
<li><strong>Raise UDP socket buffers.</strong> Set <code>SO_RCVBUF</code>/<code>SO_SNDBUF</code> on UDP sides, configurable, so bursts are absorbed by the kernel instead of dropped. The packet-rate ceiling, about 200k datagrams/s, is a <code>recv_from</code> plus channel hop per datagram. <code>recvmmsg</code> batching on Linux would lift it.</li>
<li><strong>Count drops exactly.</strong> Drop notifications ride the same broadcast channel as data events, and a lagging subscriber silently skips them. Under overload Rift reported far fewer dropped chunks than were actually lost. Keep a per-side atomic counter and expose it in status.</li>
<li><strong>Exit on SIGTERM even with stdin open.</strong> <code>rift pipe</code>/<code>rift run</code> with stdin as an open pipe, for example <code>docker run -i</code> or a supervisor that pipes stdin, does not exit on SIGTERM. The blocking <code>tokio::io::stdin()</code> read keeps the runtime alive until SIGKILL. Use <code>std::process::exit</code> after <code>stop_all</code>, or a runtime <code>shutdown_timeout</code>.</li>
<li><strong>macOS UART:</strong> <code>serialport</code> sets the baud with <code>IOSSIOSPEED</code>, which pseudo-terminals reject with <code>ENOTTY</code>. Real USB adapters work, but socat/pty loopbacks for testing do not. Falling back to <code>cfsetspeed</code> for standard rates when <code>IOSSIOSPEED</code> fails would make local testing possible.</li>
</ol>`;
}

writeFileSync(output, shell("Rift benchmark", body));
console.log(`wrote ${output}`);
