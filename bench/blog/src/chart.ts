import { BAUD_115200, formatLoss, formatRate, verdictOf } from "./model";
import type { Point } from "./types";

const WIDTH = 640;
const HEIGHT = 220;
const LEFT = 52;
const BOTTOM = 34;
const TOP = 14;

const tickLabel = (point: Point) =>
  point.rate === null ? "max" : point.rate === BAUD_115200 ? "baud" : point.rate < 1 ? `${point.rate * 1000}K` : `${point.rate}`;

const niceTop = (value: number) => {
  const step = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / step) * step;
};

export const sweepChart = (points: Point[], selected: number) => {
  const offered = points.map((point) => (point.loss >= 100 ? point.delivered : point.delivered / (1 - point.loss / 100)));
  const top = niceTop(Math.max(...offered, 1));
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const slot = (WIDTH - LEFT - 8) / points.length;
  const y = (value: number) => TOP + plotHeight - (value / top) * plotHeight;
  const grid = [0, 0.5, 1]
    .map((fraction) => {
      const value = top * fraction;
      return `<line x1="${LEFT}" x2="${WIDTH - 8}" y1="${y(value)}" y2="${y(value)}" class="grid"/><text x="${LEFT - 8}" y="${y(value) + 4}" text-anchor="end" class="axis">${formatRate(value)}</text>`;
    })
    .join("");
  const bars = points
    .map((point, index) => {
      const x = LEFT + index * slot + slot * 0.18;
      const width = slot * 0.64;
      const deliveredTop = y(point.delivered);
      const lostTop = y(offered[index]);
      const active = index === selected ? " active" : "";
      return `<g class="bar${active}" data-index="${index}">
        <rect x="${LEFT + index * slot}" y="${TOP}" width="${slot}" height="${plotHeight + BOTTOM}" class="hit"/>
        <rect x="${x}" y="${lostTop}" width="${width}" height="${Math.max(0, deliveredTop - lostTop)}" class="lost"/>
        <rect x="${x}" y="${deliveredTop}" width="${width}" height="${Math.max(0.5, TOP + plotHeight - deliveredTop)}" class="delivered ${verdictOf(point)}"/>
        <text x="${x + width / 2}" y="${HEIGHT - 14}" text-anchor="middle" class="axis">${tickLabel(point)}</text>
        <title>${tickLabel(point)} offered: ${formatRate(point.delivered)} delivered, ${formatLoss(point.loss)} lost</title>
      </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Delivered versus lost at each send rate">${grid}${bars}<text x="${WIDTH - 8}" y="${HEIGHT - 1}" text-anchor="end" class="axis">offered MB/s →</text></svg>`;
};
