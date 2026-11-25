import { barChart, COLORS, formatNumber, heatmap, lineChart, type Cell } from "./charts";
import {
  atRate,
  bidirectional,
  destination,
  findSweep,
  flowOf,
  maxLossless,
  source,
  sweeps,
  unlimited,
  type PlatformResults,
  type Sweep,
} from "./data";
import { KINDS, type CaseResult, type Kind, type Series, type Tick } from "./types";

const PLATFORM_NAME = { macos: "macOS 27.2 (host)", linux: "Linux, 2 vCPU EPYC VPS" } as const;

const kindsFor = (results: PlatformResults): Kind[] =>
  results.platform === "linux" ? KINDS : KINDS.filter((kind) => kind !== "uart");

const megabytes = (value: number) => `${formatNumber(value)} MB/s`;
const micros = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} ms` : `${value} µs`);
const percent = (value: number) => (value === 0 ? "0%" : value < 0.01 ? "<0.01%" : `${value.toFixed(value < 1 ? 2 : 1)}%`);

const missingCell = (from: Kind, to: Kind): Cell => ({
  value: null,
  label: "n/a",
  tip: `${from} → ${to}: not measurable on this platform`,
});

const sweepCell = (all: Sweep[], from: Kind, to: Kind, pick: (sweep: Sweep) => Cell | null): Cell => {
  const sweep = findSweep(all, from, to);
  return (sweep && pick(sweep)) ?? missingCell(from, to);
};

export const losslessHeatmap = (results: PlatformResults) => {
  const all = sweeps(results.matrix);
  const kinds = kindsFor(results);
  return heatmap({
    title: `Max clean throughput, ${PLATFORM_NAME[results.platform]}: highest delivered rate with <0.1% loss and no corrupt frames (1 KB frames)`,
    rows: kinds,
    columns: kinds,
    rowTitle: "data enters via",
    columnTitle: "leaves via",
    logScale: true,
    cell: (row, column) =>
      sweepCell(all, kinds[row], kinds[column], (sweep) => {
        const best = maxLossless(sweep);
        if (!best) return { value: 0.001, label: "none", tip: "no clean rate" };
        const flow = flowOf(best);
        return {
          value: flow.goodput_mbps,
          label: formatNumber(flow.goodput_mbps),
          tip: `${sweep.source} → ${sweep.destination}: ${megabytes(flow.goodput_mbps)} clean (offered ${best.rate_mbps ?? "unlimited"})`,
        };
      }),
  });
};

export const saturationHeatmap = (results: PlatformResults) => {
  const all = sweeps(results.matrix);
  const kinds = kindsFor(results);
  return heatmap({
    title: `Unthrottled sender, ${PLATFORM_NAME[results.platform]}: delivered MB/s and share of frames lost`,
    rows: kinds,
    columns: kinds,
    rowTitle: "data enters via",
    columnTitle: "leaves via",
    logScale: true,
    cell: (row, column) =>
      sweepCell(all, kinds[row], kinds[column], (sweep) => {
        const result = unlimited(sweep);
        if (!result) return null;
        const flow = flowOf(result);
        return {
          value: flow.goodput_mbps,
          label: `${formatNumber(flow.goodput_mbps)} · ${percent(flow.loss_pct)} lost`,
          tip: `${sweep.source} → ${sweep.destination}: sent ${megabytes(flow.offered_mbps)}, delivered ${megabytes(flow.goodput_mbps)}, lost ${percent(flow.loss_pct)}, corrupt frames ${flow.corrupt_frames}`,
        };
      }),
  });
};

export const latencyHeatmap = (results: PlatformResults, quantile: "p50_us" | "p99_us") => {
  const all = sweeps(results.matrix);
  const kinds = kindsFor(results);
  return heatmap({
    title: `${quantile === "p50_us" ? "Median" : "p99"} one-way latency at light load (1 MB/s, 1,000 frames/s), ${PLATFORM_NAME[results.platform]}`,
    rows: kinds,
    columns: kinds,
    rowTitle: "data enters via",
    columnTitle: "leaves via",
    logScale: true,
    cell: (row, column) =>
      sweepCell(all, kinds[row], kinds[column], (sweep) => {
        const result = atRate(sweep, 1);
        if (!result) return null;
        const latency = flowOf(result).latency;
        return {
          value: latency[quantile],
          label: micros(latency[quantile]),
          tip: `${sweep.source} → ${sweep.destination}: p50 ${micros(latency.p50_us)}, p90 ${micros(latency.p90_us)}, p99 ${micros(latency.p99_us)}, p99.9 ${micros(latency.p999_us)}, max ${micros(latency.max_us)}`,
        };
      }),
  });
};

const label = (sweep: Sweep) => `${sweep.source} → ${sweep.destination}`;

const offeredOf = (result: CaseResult) => flowOf(result).offered_mbps;

export const sweepSmallMultiples = (results: PlatformResults) => {
  const all = sweeps(results.matrix).sort((left, right) => label(left).localeCompare(label(right)));
  const charts = all.map((sweep) => {
    const points = sweep.points.filter((result) => offeredOf(result) > 0);
    const delivered: Series = {
      name: "delivered",
      color: COLORS[0],
      points: points.map((result) => ({
        x: offeredOf(result),
        y: Math.max(flowOf(result).goodput_mbps, 0.001),
        tip: `offered ${megabytes(offeredOf(result))}${result.rate_mbps === null ? " (unthrottled)" : ""}, delivered ${megabytes(flowOf(result).goodput_mbps)}, lost ${percent(flowOf(result).loss_pct)}, rss ${result.rift.rss_peak_mb.toFixed(0)} MB`,
      })),
    };
    const ideal: Series = {
      name: "offered",
      color: "#898781",
      dashed: true,
      points: points.map((result) => ({ x: offeredOf(result), y: offeredOf(result), tip: "" })),
    };
    return `<div class="multiple">${lineChart({
      title: label(sweep),
      series: [ideal, delivered],
      xLabel: "offered MB/s",
      yLabel: "delivered MB/s",
      xLog: true,
      yLog: true,
      width: 320,
      height: 200,
    })}</div>`;
  });
  return `<div class="multiples">${charts.join("")}</div>`;
};

const REPRESENTATIVE: [Kind, Kind][] = [
  ["tcp-server", "tcp-client"],
  ["udp-server", "udp-client"],
  ["udp-server", "tcp-client"],
  ["tcp-server", "udp-client"],
];

const SERIAL_REPRESENTATIVE: [Kind, Kind][] = [
  ["uart", "tcp-server"],
  ["tcp-server", "uart"],
  ["uart", "udp-client"],
  ["uart", "uart"],
];

const representativeSeries = (
  results: PlatformResults,
  pairs: [Kind, Kind][],
  value: (result: CaseResult) => number,
  tip: (result: CaseResult) => string,
): Series[] => {
  const all = sweeps(results.matrix);
  return pairs.flatMap(([from, to], index) => {
    const sweep = findSweep(all, from, to);
    if (!sweep) return [];
    return [
      {
        name: `${from} → ${to}`,
        color: COLORS[index],
        points: sweep.points
          .filter((result) => offeredOf(result) > 0)
          .map((result) => ({ x: offeredOf(result), y: Math.max(value(result), 0.001), tip: tip(result) })),
      },
    ];
  });
};

export const lossChart = (results: PlatformResults, serial = false) =>
  lineChart({
    title: `Frames lost vs offered rate, ${PLATFORM_NAME[results.platform]}${serial ? " (serial combos)" : ""}`,
    series: representativeSeries(
      results,
      serial ? SERIAL_REPRESENTATIVE : REPRESENTATIVE,
      (result) => flowOf(result).loss_pct,
      (result) => `offered ${megabytes(offeredOf(result))}, lost ${percent(flowOf(result).loss_pct)}`,
    ),
    xLabel: "offered MB/s (log)",
    yLabel: "% frames lost",
    xLog: true,
  });

export const latencyLoadChart = (results: PlatformResults, serial = false) =>
  lineChart({
    title: `p99 latency vs offered rate, ${PLATFORM_NAME[results.platform]}${serial ? " (serial combos)" : ""}`,
    series: representativeSeries(
      results,
      serial ? SERIAL_REPRESENTATIVE : REPRESENTATIVE,
      (result) => flowOf(result).latency.p99_us / 1000,
      (result) => `offered ${megabytes(offeredOf(result))}, p50 ${micros(flowOf(result).latency.p50_us)}, p99 ${micros(flowOf(result).latency.p99_us)}`,
    ),
    xLabel: "offered MB/s (log)",
    yLabel: "p99 latency, ms (log)",
    xLog: true,
    yLog: true,
  });

export const memoryLoadChart = (results: PlatformResults, serial = false) =>
  lineChart({
    title: `Peak resident memory vs offered rate, ${PLATFORM_NAME[results.platform]}${serial ? " (serial combos)" : ""}`,
    series: representativeSeries(
      results,
      serial ? SERIAL_REPRESENTATIVE : REPRESENTATIVE,
      (result) => result.rift.rss_peak_mb,
      (result) => `offered ${megabytes(offeredOf(result))}, peak RSS ${result.rift.rss_peak_mb.toFixed(1)} MB, cpu ${result.rift.cpu_avg_pct.toFixed(0)}%`,
    ),
    xLabel: "offered MB/s (log)",
    yLabel: "peak RSS, MB",
    xLog: true,
  });

export const cpuLoadChart = (results: PlatformResults) =>
  lineChart({
    title: `Rift CPU vs delivered rate, ${PLATFORM_NAME[results.platform]} (100% = one core)`,
    series: representativeSeries(
      results,
      REPRESENTATIVE,
      (result) => result.rift.cpu_avg_pct,
      (result) => `delivered ${megabytes(flowOf(result).goodput_mbps)}, cpu ${result.rift.cpu_avg_pct.toFixed(0)}%`,
    ),
    xLabel: "offered MB/s (log)",
    yLabel: "cpu %",
    xLog: true,
  });

export const peakMemoryBars = (results: PlatformResults) => {
  const all = sweeps(results.matrix);
  const bars = all
    .map((sweep) => ({
      sweep,
      peak: Math.max(...sweep.points.map((result) => result.rift.rss_peak_mb)),
      idle: atRate(sweep, 1)?.rift.rss_peak_mb ?? 0,
    }))
    .sort((left, right) => right.peak - left.peak)
    .map(({ sweep, peak, idle }) => ({
      label: label(sweep),
      value: peak,
      text: `${peak.toFixed(0)} MB (at 1 MB/s: ${idle.toFixed(1)})`,
      tip: `${label(sweep)}: worst peak RSS across the sweep ${peak.toFixed(1)} MB, at light load ${idle.toFixed(1)} MB`,
    }));
  return barChart(`Worst peak RSS across each sweep, ${PLATFORM_NAME[results.platform]}`, bars, "MB");
};

export const frameChart = (results: PlatformResults, rate: number | null) => {
  const pairs = new Map<string, CaseResult[]>();
  for (const result of results.frames.filter((entry) => entry.rate_mbps === rate)) {
    const key = `${source(result)} → ${destination(result)}`;
    pairs.set(key, [...(pairs.get(key) ?? []), result]);
  }
  const series: Series[] = [...pairs.entries()].map(([name, entries], index) => ({
    name,
    color: COLORS[index],
    points: entries
      .sort((left, right) => left.frame_size - right.frame_size)
      .map((result) => ({
        x: result.frame_size,
        y: Math.max(flowOf(result).goodput_mbps, 0.001),
        tip: `${result.frame_size} B frames: delivered ${megabytes(flowOf(result).goodput_mbps)}, lost ${percent(flowOf(result).loss_pct)}, peak RSS ${result.rift.rss_peak_mb.toFixed(0)} MB`,
      })),
  }));
  return lineChart({
    title: `Delivered rate vs frame / datagram size, ${rate === null ? "unthrottled" : `${rate} MB/s offered`}, ${PLATFORM_NAME[results.platform]}`,
    series,
    xLabel: "frame size, bytes (log)",
    yLabel: "delivered MB/s (log)",
    xLog: true,
    yLog: true,
  });
};

export const frameMemoryChart = (results: PlatformResults) => {
  const pairs = new Map<string, CaseResult[]>();
  for (const result of results.frames.filter((entry) => entry.rate_mbps !== null)) {
    const key = `${source(result)} → ${destination(result)}`;
    pairs.set(key, [...(pairs.get(key) ?? []), result]);
  }
  const series: Series[] = [...pairs.entries()].map(([name, entries], index) => ({
    name,
    color: COLORS[index],
    points: entries
      .sort((left, right) => left.frame_size - right.frame_size)
      .map((result) => ({
        x: result.frame_size,
        y: result.rift.rss_peak_mb,
        tip: `${result.frame_size} B frames at 100 MB/s: peak RSS ${result.rift.rss_peak_mb.toFixed(1)} MB, lost ${percent(flowOf(result).loss_pct)}`,
      })),
  }));
  return lineChart({
    title: `Peak RSS vs frame size at 100 MB/s offered, ${PLATFORM_NAME[results.platform]}`,
    series,
    xLabel: "frame size, bytes (log)",
    yLabel: "peak RSS, MB",
    xLog: true,
  });
};

const LOG_FLAGS = {
  "hex-quiet": "--quiet",
  quiet: "--log json --quiet",
  json: "--log json",
  hex: "--log hex",
  text: "--log text",
} as const;

export const logBars = (results: PlatformResults) => {
  const bars = results.logs.map((result, index) => {
    const flow = flowOf(result);
    return {
      label: `${source(result)} → ${destination(result)} · ${result.rate_mbps === null ? "unthrottled" : `${result.rate_mbps} MB/s`} · ${LOG_FLAGS[result.log]}`,
      value: result.rift.cpu_avg_pct,
      text: `${result.rift.cpu_avg_pct.toFixed(0)}% cpu · ${formatNumber(flow.goodput_mbps)} MB/s · ${percent(flow.loss_pct)} lost`,
      tip: `delivered ${megabytes(flow.goodput_mbps)}, lost ${percent(flow.loss_pct)}, peak RSS ${result.rift.rss_peak_mb.toFixed(0)} MB`,
      color: COLORS[Object.keys(LOG_FLAGS).indexOf(result.log)] ?? COLORS[index % 5],
    };
  });
  return barChart(`Rift CPU by log format (stdout to /dev/null), ${PLATFORM_NAME[results.platform]}`, bars, "100% = one core");
};

export const bidirectionalTable = (results: PlatformResults) => {
  const rows = bidirectional(results.matrix)
    .map((result) => {
      const [forward, backward] = result.flows;
      return `<tr><td>${result.a} ⇄ ${result.b}</td><td>${formatNumber(forward.goodput_mbps)}</td><td>${percent(forward.loss_pct)}</td><td>${formatNumber(backward?.goodput_mbps ?? 0)}</td><td>${percent(backward?.loss_pct ?? 0)}</td><td>${formatNumber(forward.goodput_mbps + (backward?.goodput_mbps ?? 0))}</td><td>${result.rift.rss_peak_mb.toFixed(0)}</td><td>${result.rift.cpu_avg_pct.toFixed(0)}</td></tr>`;
    })
    .join("");
  return `<div class="scroll"><table class="data"><thead><tr><th>pair</th><th>A→B MB/s</th><th>A→B lost</th><th>B→A MB/s</th><th>B→A lost</th><th>total MB/s</th><th>peak RSS MB</th><th>cpu %</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

export const fullTable = (results: PlatformResults) => {
  const rows = results.matrix
    .filter((result) => result.direction !== "both")
    .map((result) => {
      const flow = flowOf(result);
      return `<tr><td>${source(result)} → ${destination(result)}</td><td>${result.rate_mbps ?? "max"}</td><td>${formatNumber(flow.offered_mbps)}</td><td>${formatNumber(flow.goodput_mbps)}</td><td>${percent(flow.loss_pct)}</td><td>${flow.corrupt_frames}</td><td>${micros(flow.latency.p50_us)}</td><td>${micros(flow.latency.p99_us)}</td><td>${micros(flow.latency.max_us)}</td><td>${result.rift.rss_peak_mb.toFixed(1)}</td><td>${result.rift.cpu_avg_pct.toFixed(0)}</td><td>${result.rift_dropped_chunks}</td></tr>`;
    })
    .join("");
  return `<div class="scroll"><table class="data"><thead><tr><th>flow</th><th>target MB/s</th><th>sent MB/s</th><th>delivered MB/s</th><th>lost</th><th>corrupt</th><th>p50</th><th>p99</th><th>max</th><th>peak RSS MB</th><th>cpu %</th><th>drops reported</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

const tickSeries = (ticks: Tick[], value: (tick: Tick) => number, name: string, color: string, unit: string): Series => ({
  name,
  color,
  markers: false,
  points: ticks.map((tick) => ({ x: tick.elapsed_s / 60, y: value(tick), tip: `${(tick.elapsed_s / 60).toFixed(1)} min: ${value(tick).toFixed(2)} ${unit}` })),
});

const downsample = (ticks: Tick[], limit: number) => {
  const step = Math.max(1, Math.ceil(ticks.length / limit));
  return ticks.filter((_, index) => index % step === 0);
};

const WARM_UP_SECONDS = 30;

const profilesOf = (ticks: Tick[]) => [...new Set(ticks[0].flows.map((flow) => flow.name.split(" ")[0]))];

const profileFlows = (tick: Tick, profile: string) => tick.flows.filter((flow) => flow.name.startsWith(`${profile} `));

const sentRate = (ticks: Tick[], index: number) => {
  if (index === 0) return 0;
  const seconds = ticks[index].elapsed_s - ticks[index - 1].elapsed_s || 1;
  const sent = (tick: Tick) => tick.flows.filter((flow) => !flow.name.startsWith("control ")).reduce((sum, flow) => sum + flow.sent_total, 0);
  return ((sent(ticks[index]) - sent(ticks[index - 1])) * 1024) / seconds / 1e6;
};

export const soakCharts = (results: PlatformResults) => {
  const ticks = downsample(results.ticks, 300);
  if (ticks.length === 0) return `<p class="muted">no soak data</p>`;
  const profiles = profilesOf(ticks);
  const warmUp = ticks.find((tick) => tick.elapsed_s >= WARM_UP_SECONDS) ?? ticks[0];
  const perProfile = (value: (tick: Tick, profile: string) => number, unit: string) =>
    profiles.map((profile, index) => tickSeries(ticks, (tick) => value(tick, profile), profile, COLORS[index], unit));
  const throughput = perProfile((tick, profile) => profileFlows(tick, profile).reduce((sum, flow) => sum + flow.mbps, 0), "MB/s");
  const latency = perProfile((tick, profile) => Math.max(...profileFlows(tick, profile).map((flow) => flow.p99_us)) / 1000, "ms p99");
  const lostAt = (tick: Tick, profile: string) => profileFlows(tick, profile).reduce((sum, flow) => sum + flow.lost_total, 0);
  const lost = perProfile((tick, profile) => Math.max(0, lostAt(tick, profile) - lostAt(warmUp, profile)), "frames lost after warm-up");
  const name = PLATFORM_NAME[results.platform];
  return [
    lineChart({ title: `Delivered MB/s per profile over time, ${name}`, series: throughput, xLabel: "minutes", yLabel: "MB/s" }),
    lineChart({ title: `Worst p99 latency per 5 s window, ${name} ("control" is a direct TCP flow with no Rift in the path)`, series: latency, xLabel: "minutes", yLabel: "p99, ms", yLog: true }),
    lineChart({ title: `Frames lost after the first ${WARM_UP_SECONDS} s (sent minus received, includes frames in flight), ${name}`, series: lost, xLabel: "minutes", yLabel: "frames" }),
    lineChart({ title: `Rift resident memory over time, ${name}`, series: [tickSeries(ticks, (tick) => tick.rift.rss_mb, "rss", COLORS[0], "MB")], xLabel: "minutes", yLabel: "RSS, MB" }),
    lineChart({ title: `Rift CPU over time, ${name} (100% = one core)`, series: [tickSeries(ticks, (tick) => tick.rift.cpu_pct, "cpu", COLORS[1], "%")], xLabel: "minutes", yLabel: "cpu %" }),
    lineChart({
      title: `Open file descriptors and threads, ${name}`,
      series: [
        tickSeries(ticks, (tick) => tick.rift.open_files, "open fds", COLORS[2], "fds"),
        tickSeries(ticks, (tick) => tick.rift.threads, "threads", COLORS[3], "threads"),
      ],
      xLabel: "minutes",
      yLabel: "count",
    }),
  ].join("");
};

export const collapseChart = (raw: Tick[], title: string) => {
  if (raw.length === 0) return "";
  const ticks = downsample(raw, 300);
  const offered: Series = {
    name: "offered",
    color: "#898781",
    markers: false,
    dashed: true,
    points: ticks.slice(1).map((tick, index) => ({ x: tick.elapsed_s / 60, y: sentRate(ticks, index + 1), tip: "" })),
  };
  const delivered = tickSeries(
    ticks,
    (tick) => tick.flows.filter((flow) => !flow.name.startsWith("control ")).reduce((sum, flow) => sum + flow.mbps, 0),
    "delivered",
    COLORS[0],
    "MB/s",
  );
  const cpu = tickSeries(ticks, (tick) => tick.rift.cpu_pct, "rift cpu", COLORS[1], "%");
  return `<div class="grid2">${lineChart({ title, series: [offered, delivered], xLabel: "minutes", yLabel: "MB/s" })}${lineChart({ title: "Rift CPU in the same run (100% = one core)", series: [cpu], xLabel: "minutes", yLabel: "cpu %" })}</div>`;
};
