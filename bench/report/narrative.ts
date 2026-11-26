import { formatNumber } from "./charts";
import { atRate, findSweep, flowOf, maxLossless, sweeps, unlimited, type PlatformResults } from "./data";
import type { Kind } from "./types";

const platformLabel = (results: PlatformResults) => (results.platform === "macos" ? "macOS" : "Linux");

const sweepOf = (results: PlatformResults, from: Kind, to: Kind) => findSweep(sweeps(results.matrix), from, to);

const tcpStats = (results: PlatformResults) => {
  const sweep = sweepOf(results, "tcp-server", "tcp-client");
  if (!sweep) return null;
  const clean = maxLossless(sweep);
  const max = unlimited(sweep);
  const light = atRate(sweep, 1);
  const direct = results.baseline.find((entry) => entry.transport === "tcp" && entry.rate_mbps === null);
  const directLight = results.baseline.find((entry) => entry.transport === "tcp" && entry.rate_mbps === 1);
  return {
    clean: clean ? flowOf(clean).goodput_mbps : 0,
    maxDelivered: max ? flowOf(max).goodput_mbps : 0,
    maxLoss: max ? flowOf(max).loss_pct : 0,
    lightP50: light ? flowOf(light).latency.p50_us : 0,
    lightP99: light ? flowOf(light).latency.p99_us : 0,
    lightRss: light ? light.rift.rss_peak_mb : 0,
    direct: direct?.flow.goodput_mbps ?? 0,
    directP50: directLight?.flow.latency.p50_us ?? 0,
  };
};

const worstRss = (results: PlatformResults) => Math.max(...results.matrix.map((result) => result.rift.rss_peak_mb));

export const summaryTiles = (platforms: PlatformResults[]) => {
  const tiles = platforms.flatMap((results) => {
    const stats = tcpStats(results);
    if (!stats) return [];
    const soak = results.soak;
    const last = results.ticks.at(-1);
    return [
      `<div class="tile"><b>${formatNumber(stats.clean)} MB/s</b><span>${platformLabel(results)} TCP→TCP highest clean step (direct loopback: ${formatNumber(stats.direct)} MB/s)</span></div>`,
      `<div class="tile"><b>${formatNumber(stats.maxDelivered)} MB/s · ${stats.maxLoss.toFixed(0)}% lost</b><span>${platformLabel(results)} TCP→TCP with an unthrottled sender</span></div>`,
      `<div class="tile"><b>${stats.lightP50} µs / ${stats.lightP99} µs</b><span>${platformLabel(results)} TCP→TCP p50 / p99 at 1 MB/s (direct p50 ${stats.directP50} µs)</span></div>`,
      `<div class="tile"><b>${stats.lightRss.toFixed(0)} MB → ${worstRss(results).toFixed(0)} MB</b><span>${platformLabel(results)} RSS at light load → worst peak in any run</span></div>`,
      soak || last
        ? `<div class="tile"><b>${soak ? (soak.survived ? "survived" : "crashed") : "running"} ${((last?.elapsed_s ?? 0) / 60).toFixed(0)} min</b><span>${platformLabel(results)} soak, RSS ${last?.rift.rss_mb.toFixed(0)} MB at the end</span></div>`
        : "",
    ];
  });
  return `<div class="tiles">${tiles.join("")}</div>`;
};

export const findings = (platforms: PlatformResults[]) => `
<div class="finding bad"><h4><span class="tag bad">critical</span>Overload silently drops data, and TCP streams arrive spliced</h4>
<p>Rift never pushes back on a fast sender. When the outbound side cannot keep up, the bridge drops whole 4 KB read chunks (<code>try_send</code> into a 256-slot queue). With an unthrottled TCP sender, 70 to 85% of the bytes are thrown away, and the TCP receiver gets a byte stream with holes cut at arbitrary offsets. Any protocol on top sees corruption, not just a gap. A direct TCP connection on the same machine moves the same load at 2.7 GB/s with zero loss, because TCP flow control slows the sender instead.</p></div>
<div class="finding bad"><h4><span class="tag bad">high</span>Loss starts well below the ceiling, in bursts</h4>
<p>The queue holds about 1 MB, roughly 5 ms of traffic at 200 MB/s, so any short stall loses data. Several directions are clean at 300 MB/s but lose 1 to 7% at 200 or 400 MB/s in the same sweep. It depends on timing, not on rate. Treat about 100 MB/s per direction on TCP and about 50 MB/s on UDP as the reliably clean envelope on this machine.</p></div>
<div class="finding warn"><h4><span class="tag warn">medium</span>About one CPU core per 100 MB/s</h4>
<p>At 100 MB/s TCP→TCP Rift uses about 90 to 95% of one core, and it saturates at 3 to 3.5 cores when overloaded. Most of the cost is per-chunk work done even with <code>--quiet</code>: each chunk is copied into two event payloads and broadcast to the log subscriber.</p></div>
<div class="finding warn"><h4><span class="tag warn">medium</span>UDP tops out at about 200k datagrams per second</h4>
<p>Small datagrams hit a packet-rate limit: 64 B datagrams deliver only about 13 MB/s, and 256 B datagrams lose 5 to 13% at 50 MB/s. Large datagrams scale well: 8 KB datagrams reach 1.1 to 1.3 GB/s. A UDP source that feeds a UDP-server side, which fans out to every known peer, is the weakest path.</p></div>
<div class="finding warn"><h4><span class="tag warn">medium</span>Memory is small at rest but spikes under overload</h4>
<p>Rift idles at about 8 MB RSS and stays under 15 MB at moderate rates. Overloaded runs peak at 100 to 400 MB as queues, broadcast rings and the allocator fill. The soak below checks whether it comes back down and stays flat over hours.</p></div>
<div class="finding warn"><h4><span class="tag warn">medium</span>Drop reports and logs are incomplete under load</h4>
<p>Drop notifications and data logs share one broadcast channel (4096 events). When the printer lags, tokio skips the oldest events, and <code>dropped N chunks</code> notifications go with them. In overloaded runs Rift reported a fraction of the chunks it actually discarded. The log is not an audit trail at high rates.</p></div>
<div class="finding warn"><h4><span class="tag warn">medium</span>SIGTERM is ignored while stdin is an open pipe</h4>
<p><code>rift pipe</code> with stdin connected to a pipe that never closes does not exit on SIGTERM: it was still alive after 3 s and needed SIGKILL. With stdin on <code>/dev/null</code> it exits at once. This affects <code>docker run -i</code> and supervisors that pipe stdin.</p></div>
<div class="finding good"><h4><span class="tag good">good</span>110-minute soak: no leaks, flat memory, no crash</h4>
<p>One <code>rift run</code> process carried 7 flows for 110 minutes on macOS: TCP 40 MB/s each way, UDP 10 MB/s each way, UDP→TCP 10 MB/s each way, plus a TCP client reconnecting every second. That is about 120 MB/s, roughly 830 GB in total. RSS stayed between 17 and 36 MB and ended at 19 MB. Threads stayed at 12 and file descriptors at 45 through about 6,600 reconnects. CPU ran at 150 to 180% of one core. Steady-state loss was about 0.004% per flow, all of it in short stalls that also hit a direct TCP control flow, so they came from the host.</p>
<p>At minute 62 the host ran out of network buffers (<code>ENOBUFS</code>), which also broke the control connection. Rift's TCP-client side lost its peer and kept retrying, which is correct. That profile then sat idle only because the harness accepts a single connection. The other profiles carried on unaffected.</p></div>
<div class="finding good"><h4><span class="tag good">good</span>Light-load latency is low and stable across every combination</h4>
<p>At 1 MB/s every side combination has a median one-way latency of about 110 to 130 µs and a p99 of 180 to 330 µs. That is about 50 µs over a direct loopback connection, since Rift adds one kernel round trip. Nothing reordered frames in any run.</p></div>
<div class="finding info"><h4><span class="tag info">note</span>UART was measured on Linux only</h4>
<p>On macOS, <code>serialport</code> sets the baud rate through <code>IOSSIOSPEED</code>, which pseudo-terminals reject with <code>Not a typewriter</code>, so a pty cannot stand in for a serial port. UART combinations ran on Linux, where ptys accept termios. A pty is not baud-limited, so those numbers are Rift's serial-path ceiling. A real 115200 baud link carries about 11.5 KB/s, and anything faster from a network side overflows Rift's queue and is dropped. On Linux, serial→network stays clean up to about 60 MB/s, while network→serial loses 74 to 90% of the data once overloaded.</p></div>
<div class="finding info"><h4><span class="tag info">note</span>Linux ran on a 2 vCPU VPS</h4>
<p>The Linux machine is a small cloud VM: 2 vCPUs on an AMD EPYC 9354P, shared by Rift and the harness. Its numbers are an edge-box profile, not a like-for-like comparison with the 11-core M3 Pro. Clean throughput there is about 10 to 50 MB/s per TCP direction and 1 to 10 MB/s for UDP sources. The 60-minute soak at the same 120 MB/s mix was overloaded from the first minute and delivered about 2 to 10 MB/s per flow with heavy loss. Rift itself survived the full hour with RSS flat near 40 MB. The 2 MB/s serial profile in that soak stayed almost lossless.</p></div>
${platforms.length < 2 ? `<p class="muted">Linux results are not included in this build.</p>` : ""}
`;

export const method = (platforms: PlatformResults[]) => {
  const baselineRows = platforms
    .flatMap((results) =>
      results.baseline.map(
        (entry) =>
          `<tr><td>${platformLabel(results)}</td><td>${entry.transport}</td><td>${entry.rate_mbps ?? "max"}</td><td>${formatNumber(entry.flow.goodput_mbps)}</td><td>${entry.flow.loss_pct.toFixed(2)}%</td><td>${entry.flow.latency.p50_us} µs</td><td>${entry.flow.latency.p99_us} µs</td></tr>`,
      ),
    )
    .join("");
  return `
<p>A purpose-built harness (<code>bench/</code>, Rust, standalone crate) runs the shipped <code>rift</code> release binary as a child process and plays the outside party on both sides. It writes sequence-numbered frames into one side and reads them from the other.</p>
<ul>
<li><strong>Side types:</strong> tcp-server, tcp-client, udp-server, udp-client, uart. All 15 unordered pairs, including same-type pairs, in both directions: 25 directed combinations, 16 on macOS.</li>
<li><strong>Outer peers:</strong> TCP connect or accept, UDP sockets with 7 MB buffers (a hello datagram registers the harness with a udp-server side), and a raw pseudo-terminal pair standing in for the UART (<code>uart:///dev/pts/N?baud=115200</code>).</li>
<li><strong>Frames:</strong> magic, length, sequence, send timestamp, a filler byte pattern and a trailing sequence. The receiver re-syncs on the magic, so it tolerates re-chunking. It counts delivered, lost (sent minus delivered), out-of-order and corrupt frames (a torn or spliced frame fails the filler or tail check), and records per-frame latency in an HDR histogram.</li>
<li><strong>Rate sweep:</strong> paced sender at fixed MB/s steps, then unthrottled. 1 KB frames, 4 s per step, a fresh <code>rift pipe</code> process per run.</li>
<li><strong>Bidirectional:</strong> both directions unthrottled at once, per pair.</li>
<li><strong>Frame size:</strong> 64 B to 8 KB, at 100 MB/s and unthrottled, on four representative directions. The loopback UDP datagram limit on macOS is 9216 bytes.</li>
<li><strong>Logging:</strong> <code>--log json --quiet</code> (the harness default), plus <code>--log json|hex|text</code> printing every chunk to <code>/dev/null</code>.</li>
<li><strong>Resources:</strong> RSS, CPU time, thread count and open file descriptors of the Rift process, every 100 ms (1 s in the soak), via <code>proc_pidinfo</code> on macOS and <code>/proc</code> on Linux.</li>
<li><strong>Soak:</strong> one <code>rift run --all</code> process with several profiles carrying sustained traffic both ways for hours, plus a TCP client that reconnects every second to catch leaks.</li>
</ul>
<p><strong>Caveats.</strong> On each platform everything runs on one machine over loopback, so the harness competes with Rift for cores, and an iOS simulator and system scans ran in the background (load average about 4). UDP sender throughput is capped by the harness at about 200 to 230 MB/s with 1 KB datagrams (the direct baseline shows the same cap). The Linux runs are on a 2 vCPU KVM guest, where the harness and Rift compete for the same two cores, so Linux throughput is a lower bound.</p>
<h3>Direct loopback baseline, no Rift in the path</h3>
<div class="scroll"><table class="data"><thead><tr><th>platform</th><th>transport</th><th>target MB/s</th><th>delivered MB/s</th><th>lost</th><th>p50</th><th>p99</th></tr></thead><tbody>${baselineRows}</tbody></table></div>`;
};

export const reproduce = () => `<pre>cargo build --release -p rift-cli
cd bench && cargo build --release
./target/release/rift-bench suites --out results/macos            # baseline, matrix, frames, logs
./target/release/rift-bench case --a tcp-server --b udp-client --rate 200 --seconds 10
./target/release/rift-bench soak --minutes 110 --tcp-rate 80 --udp-rate 20 --out results/macos/soak
# Linux, UART included (Docker): rift-bench --rift /build/release/rift suites --serial --out results/linux
bun report/build.ts results REPORT.html</pre>`;
