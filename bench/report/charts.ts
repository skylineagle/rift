import type { Series } from "./types";

const INK = "#f0efec";
const MUTED = "#898781";
const GRID = "#2c2c2a";
const AXIS = "#383835";

export const COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const formatNumber = (value: number) => {
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return `${(value / 1000).toFixed(magnitude >= 10000 ? 0 : 1)}k`;
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(magnitude % 1 === 0 ? 0 : 1);
  if (magnitude >= 1) return value.toFixed(magnitude % 1 === 0 ? 0 : 1);
  if (magnitude === 0) return "0";
  return value.toPrecision(2);
};

interface Scale {
  map: (value: number) => number;
  ticks: number[];
}

const niceStep = (span: number, count: number) => {
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
};

const linearScale = (low: number, high: number, start: number, end: number): Scale => {
  const span = high - low || 1;
  const step = niceStep(span, 5);
  const top = Math.ceil(high / step) * step;
  const bottom = Math.floor(low / step) * step;
  const ticks: number[] = [];
  for (let tick = bottom; tick <= top + step / 2; tick += step) ticks.push(Number(tick.toPrecision(10)));
  return { map: (value) => start + ((value - bottom) / (top - bottom || 1)) * (end - start), ticks };
};

const logScale = (low: number, high: number, start: number, end: number): Scale => {
  const bottom = Math.floor(Math.log10(Math.max(low, 1e-9)));
  const top = Math.ceil(Math.log10(Math.max(high, 1e-9)));
  const ticks: number[] = [];
  for (let power = bottom; power <= top; power++) ticks.push(10 ** power);
  return {
    map: (value) => start + ((Math.log10(Math.max(value, 10 ** bottom)) - bottom) / (top - bottom || 1)) * (end - start),
    ticks,
  };
};

export interface LineChartOptions {
  series: Series[];
  xLabel: string;
  yLabel: string;
  xLog?: boolean;
  yLog?: boolean;
  yZero?: boolean;
  height?: number;
  width?: number;
  title: string;
}

export const legend = (series: Series[]) =>
  series.length < 2
    ? ""
    : `<div class="legend">${series
        .map(
          (entry) =>
            `<span><i style="background:${entry.color}${entry.dashed ? ";opacity:.6" : ""}"></i>${escape(entry.name)}</span>`,
        )
        .join("")}</div>`;

export const lineChart = (options: LineChartOptions) => {
  const width = options.width ?? 640;
  const height = options.height ?? 260;
  const margin = { left: 52, right: 14, top: 12, bottom: 38 };
  const points = options.series.flatMap((entry) => entry.points);
  if (points.length === 0) return `<p class="muted">no data</p>`;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xScale = (options.xLog ? logScale : linearScale)(Math.min(...xs), Math.max(...xs), margin.left, width - margin.right);
  const yLow = options.yZero === false ? Math.min(...ys) : Math.min(0, ...ys);
  const yScale = (options.yLog ? logScale : linearScale)(
    options.yLog ? Math.min(...ys.filter((y) => y > 0)) : yLow,
    Math.max(...ys),
    height - margin.bottom,
    margin.top,
  );
  const grid = yScale.ticks
    .map((tick) => {
      const y = yScale.map(tick).toFixed(1);
      return `<line x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}" stroke="${GRID}"/><text x="${margin.left - 6}" y="${y}" dy="4" text-anchor="end">${formatNumber(tick)}</text>`;
    })
    .join("");
  const xTicks = xScale.ticks
    .map((tick) => {
      const x = xScale.map(tick).toFixed(1);
      return `<text x="${x}" y="${height - margin.bottom + 16}" text-anchor="middle">${formatNumber(tick)}</text>`;
    })
    .join("");
  const lines = options.series
    .map((entry) => {
      const path = entry.points
        .map((point, index) => `${index === 0 ? "M" : "L"}${xScale.map(point.x).toFixed(0)},${yScale.map(point.y).toFixed(0)}`)
        .join("");
      const dots = entry.dashed || entry.markers === false
        ? ""
        : entry.points
            .map(
              (point) =>
                `<circle cx="${xScale.map(point.x).toFixed(0)}" cy="${yScale.map(point.y).toFixed(0)}" r="4" fill="${entry.color}"><title>${escape(`${entry.name}: ${point.tip}`)}</title></circle>`,
            )
            .join("");
      return `<path d="${path}" fill="none" stroke="${entry.color}" stroke-width="2" ${entry.dashed ? 'stroke-dasharray="4 4" opacity=".6"' : ""} stroke-linejoin="round"/>${dots}`;
    })
    .join("");
  return `<figure><figcaption>${escape(options.title)}</figcaption>${legend(options.series)}<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(options.title)}">
<g class="axis">${grid}${xTicks}<line x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" stroke="${AXIS}"/>
<text x="${(margin.left + width - margin.right) / 2}" y="${height - 4}" text-anchor="middle">${escape(options.xLabel)}</text>
<text transform="rotate(-90)" x="${-(margin.top + height - margin.bottom) / 2}" y="12" text-anchor="middle">${escape(options.yLabel)}</text></g>
<g stroke="#1a1a19" stroke-width="2">${lines}</g></svg></figure>`;
};

export interface Cell {
  value: number | null;
  label: string;
  tip: string;
}

const mix = (from: number[], to: number[], amount: number) =>
  from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));

const RAMP_LOW = [22, 38, 61];
const RAMP_HIGH = [157, 197, 245];

export const rampColor = (fraction: number) => {
  const [red, green, blue] = mix(RAMP_LOW, RAMP_HIGH, Math.min(1, Math.max(0, fraction)));
  return { fill: `rgb(${red},${green},${blue})`, ink: fraction > 0.55 ? "#0b0b0b" : INK };
};

export interface HeatmapOptions {
  title: string;
  rows: string[];
  columns: string[];
  rowTitle: string;
  columnTitle: string;
  cell: (row: number, column: number) => Cell;
  logScale?: boolean;
}

export const heatmap = (options: HeatmapOptions) => {
  const cells = options.rows.flatMap((_, row) => options.columns.map((__, column) => options.cell(row, column)));
  const values = cells.map((cell) => cell.value).filter((value): value is number => value !== null && value > 0);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const fraction = (value: number) =>
    options.logScale
      ? (Math.log10(value) - Math.log10(low)) / (Math.log10(high) - Math.log10(low) || 1)
      : value / (high || 1);
  const head = options.columns.map((column) => `<th scope="col">${escape(column)}</th>`).join("");
  const body = options.rows
    .map((row, rowIndex) => {
      const tds = options.columns
        .map((_, columnIndex) => {
          const cell = options.cell(rowIndex, columnIndex);
          if (cell.value === null) return `<td class="empty" title="${escape(cell.tip)}">${escape(cell.label)}</td>`;
          const color = rampColor(cell.value > 0 ? fraction(cell.value) : 0);
          return `<td style="background:${color.fill};color:${color.ink}" title="${escape(cell.tip)}">${escape(cell.label)}</td>`;
        })
        .join("");
      return `<tr><th scope="row">${escape(row)}</th>${tds}</tr>`;
    })
    .join("");
  return `<figure><figcaption>${escape(options.title)}</figcaption><div class="scroll"><table class="heat"><thead><tr><th class="corner">${escape(options.rowTitle)} ↓ / ${escape(options.columnTitle)} →</th>${head}</tr></thead><tbody>${body}</tbody></table></div></figure>`;
};

export interface Bar {
  label: string;
  value: number;
  text: string;
  tip: string;
  color?: string;
}

export const barChart = (title: string, bars: Bar[], unit: string) => {
  const high = Math.max(...bars.map((bar) => bar.value), 1e-9);
  const rows = bars
    .map(
      (bar) =>
        `<div class="bar" title="${escape(bar.tip)}"><span class="bar-label">${escape(bar.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${((bar.value / high) * 100).toFixed(1)}%;background:${bar.color ?? COLORS[0]}"></span></span><span class="bar-value">${escape(bar.text)}</span></div>`,
    )
    .join("");
  return `<figure><figcaption>${escape(title)} <span class="muted">(${escape(unit)})</span></figcaption><div class="bars">${rows}</div></figure>`;
};
