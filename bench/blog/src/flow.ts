import { clock, effect, frameLoop, init, surface } from "vgpu";

export interface FlowState {
  density: number;
  loss: number;
  heat: number;
}

type Color = [number, number, number];

const readColor = (name: string): Color => {
  const probe = document.createElement("i");
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const [red = 0, green = 0, blue = 0] = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  probe.remove();
  return [red / 255, green / 255, blue / 255];
};

const palette = () => ({
  background: readColor("--stage"),
  ink: readColor("--particle"),
  delivered: readColor("--signal-good"),
  dropped: readColor("--signal-bad"),
});

export const startFlow = async (canvas: HTMLCanvasElement) => {
  const gpu = await init();
  const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });
  const aspect = () => canvasSurface.size[0] / Math.max(1, canvasSurface.size[1]);
  const flow = effect(gpu, FLOW_SHADER, {
    set: { params: { time: 0, aspect: aspect(), density: 0.3, loss: 0, speed: 0.1, heat: 0, ...palette() } },
  });
  canvasSurface.onResize(() => flow.set({ params: { aspect: aspect() } }));
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const repaint = () => flow.set({ params: palette() });
  scheme.addEventListener("change", repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const time = clock(gpu);
  frameLoop(gpu, (frame) => {
    flow.set({ params: { time: still.matches ? 4 : time.time } });
    frame.pass(canvasSurface, flow);
  });

  return (state: FlowState) =>
    flow.set({ params: { density: state.density, loss: state.loss, heat: state.heat, speed: 0.05 + 0.09 * state.density } });
};
