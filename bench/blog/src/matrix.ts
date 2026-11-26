import { KIND_LABEL, KINDS, cleanCeiling, firstLossyRate, formatRate, pairKey, peakDelivered, sweepOf } from "./model";
import type { Kind, Platform } from "./types";

const bucketOf = (ceiling: number) => (ceiling >= 100 ? 4 : ceiling >= 50 ? 3 : ceiling >= 10 ? 2 : ceiling > 1 ? 1 : 0);

const cell = (platform: Platform, source: Kind, destination: Kind, active: boolean) => {
  const points = sweepOf(platform, source, destination);
  if (points.length === 0) return `<td class="empty" aria-label="not measured">·</td>`;
  const ceiling = cleanCeiling(points);
  const breaks = firstLossyRate(points);
  return `<td><button type="button" class="cell b${bucketOf(ceiling)}${active ? " active" : ""}" data-pair="${pairKey(source, destination)}"
    title="${KIND_LABEL[source]} → ${KIND_LABEL[destination]}: clean up to ${formatRate(ceiling)}, peak ${formatRate(peakDelivered(points))}">
    <b>${formatRate(ceiling)}</b><small>${breaks === null ? "never lost" : `leaks at ${formatRate(breaks)}`}</small></button></td>`;
};

export const renderMatrix = (host: HTMLElement, platform: Platform, activeSource: Kind, activeDestination: Kind) => {
  const kinds = KINDS.filter((kind) => platform === "linux" || kind !== "uart");
  const header = kinds.map((kind) => `<th scope="col">${KIND_LABEL[kind]}</th>`).join("");
  const rows = kinds
    .map(
      (source) =>
        `<tr><th scope="row">${KIND_LABEL[source]}</th>${kinds
          .map((destination) => cell(platform, source, destination, source === activeSource && destination === activeDestination))
          .join("")}</tr>`,
    )
    .join("");
  host.innerHTML = `<table><thead><tr><th class="corner"><span>enters at ↓</span><span>leaves at →</span></th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
};
