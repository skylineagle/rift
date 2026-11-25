import { sweepChart } from "./chart";
import { startFlow, type FlowState } from "./flow";
import { renderMatrix } from "./matrix";
import {
  KIND_LABEL,
  KIND_ROLE,
  KINDS,
  PLATFORM_LABEL,
  VERDICT_LABEL,
  formatLoss,
  formatOffered,
  formatRate,
  sweepOf,
  verdictOf,
} from "./model";
import type { Kind, Platform, Point } from "./types";

interface State {
  platform: Platform;
  source: Kind;
  destination: Kind;
  index: number;
}

const state: State = { platform: "linux", source: "uart", destination: "tcp-server", index: 0 };

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const sourceSelect = element<HTMLSelectElement>("source");
const destinationSelect = element<HTMLSelectElement>("destination");
const rateSlider = element<HTMLInputElement>("rate");
const chartHost = element<HTMLDivElement>("chart");
let pushFlow: ((flow: FlowState) => void) | null = null;

const kindsFor = (platform: Platform) => KINDS.filter((kind) => platform === "linux" || kind !== "uart");

const fillSelect = (select: HTMLSelectElement, platform: Platform, value: Kind) => {
  select.innerHTML = kindsFor(platform)
    .map((kind) => `<option value="${kind}" ${kind === value ? "selected" : ""}>${KIND_LABEL[kind]} · ${KIND_ROLE[kind]}</option>`)
    .join("");
};

const offeredOf = (point: Point) => (point.loss >= 100 ? point.delivered : point.delivered / (1 - point.loss / 100));

const flowStateOf = (point: Point): FlowState => ({
  density: Math.min(0.95, 0.1 + (0.85 * Math.log10(1 + offeredOf(point) * 100)) / Math.log10(1 + 1500 * 100)),
  loss: point.loss / 100,
  heat: Math.min(1, point.loss / 30),
});

const verdictSentence = (point: Point) => {
  const verdict = verdictOf(point);
  if (verdict === "clean") return "Everything sent arrives. Rift keeps up.";
  if (verdict === "leaking") return "Most data arrives, but Rift drops chunks in bursts. Any protocol on top sees holes.";
  return "Rift cannot keep up. It does not slow the sender down, it throws data away.";
};

const nearestIndex = (points: Point[], rate: number | null) => {
  if (rate === null) return points.length - 1;
  const distances = points.map((point) => Math.abs(Math.log((point.rate ?? 1e5) + 1e-4) - Math.log(rate + 1e-4)));
  return distances.indexOf(Math.min(...distances));
};

const render = () => {
  const points = sweepOf(state.platform, state.source, state.destination);
  state.index = Math.min(state.index, points.length - 1);
  const point = points[state.index];
  rateSlider.max = String(points.length - 1);
  rateSlider.value = String(state.index);
  element("side-a").textContent = KIND_LABEL[state.source];
  element("side-b").textContent = KIND_LABEL[state.destination];
  element("role-a").textContent = KIND_ROLE[state.source];
  element("role-b").textContent = KIND_ROLE[state.destination];
  element("offered").textContent = formatOffered(point.rate);
  element("delivered").textContent = formatRate(point.delivered);
  element("lost").textContent = formatLoss(point.loss);
  const verdict = element("verdict");
  verdict.textContent = VERDICT_LABEL[verdictOf(point)];
  verdict.dataset.verdict = verdictOf(point);
  element("verdict-text").textContent = verdictSentence(point);
  element("platform-note").textContent = PLATFORM_LABEL[state.platform];
  chartHost.innerHTML = sweepChart(points, state.index);
  document.querySelectorAll<HTMLButtonElement>("[data-platform]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.platform === state.platform));
  });
  renderMatrix(element("matrix"), state.platform, state.source, state.destination);
  pushFlow?.(flowStateOf(point));
};

const select = (next: Partial<State>) => {
  const before = sweepOf(state.platform, state.source, state.destination)[state.index]?.rate ?? null;
  Object.assign(state, next);
  if (!kindsFor(state.platform).includes(state.source)) state.source = "tcp-server";
  if (!kindsFor(state.platform).includes(state.destination)) state.destination = "tcp-client";
  fillSelect(sourceSelect, state.platform, state.source);
  fillSelect(destinationSelect, state.platform, state.destination);
  if (next.index === undefined) state.index = nearestIndex(sweepOf(state.platform, state.source, state.destination), before);
  render();
};

sourceSelect.addEventListener("change", () => select({ source: sourceSelect.value as Kind }));
destinationSelect.addEventListener("change", () => select({ destination: destinationSelect.value as Kind }));
rateSlider.addEventListener("input", () => select({ index: Number(rateSlider.value) }));
element("swap").addEventListener("click", () => select({ source: state.destination, destination: state.source }));
document.querySelectorAll<HTMLButtonElement>("[data-platform]").forEach((button) =>
  button.addEventListener("click", () => select({ platform: button.dataset.platform as Platform })),
);
chartHost.addEventListener("click", (event) => {
  const bar = (event.target as Element).closest<SVGGElement>("[data-index]");
  if (bar) select({ index: Number(bar.dataset.index) });
});
element("matrix").addEventListener("click", (event) => {
  const cell = (event.target as Element).closest<HTMLButtonElement>("[data-pair]");
  if (!cell) return;
  const [source, destination] = (cell.dataset.pair ?? "").split(">") as [Kind, Kind];
  select({ source, destination });
  element("simulator").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((button) =>
  button.addEventListener("click", () => {
    const [platform, source, destination, rate] = (button.dataset.jump ?? "").split(" ");
    select({ platform: platform as Platform, source: source as Kind, destination: destination as Kind });
    const points = sweepOf(state.platform, state.source, state.destination);
    select({ index: nearestIndex(points, rate === "max" ? null : Number(rate)) });
    element("simulator").scrollIntoView({ behavior: "smooth", block: "start" });
  }),
);

select({ index: sweepOf("linux", "uart", "tcp-server").length - 1 });

startFlow(element<HTMLCanvasElement>("flow"))
  .then((push) => {
    pushFlow = push;
    render();
  })
  .catch(() => element("stage").classList.add("no-gpu"));
