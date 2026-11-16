import type { SideStatusName } from "@/lib/sideStatus";
import type { RiftEvent } from "@/lib/types";
import { selectBridge, bridgeStore } from "@/stores/bridgeStore";
import { subscribeToEvents } from "@/stores/eventStream";
import { themeStore } from "@/stores/themeStore";

type EndState = "idle" | "wait" | "ok" | "err";
type Direction = "AB" | "BA";

type Particle = {
  direction: Direction;
  startedAt: number;
  duration: number;
  offset: number;
  phase: number;
  size: number;
  dropped: boolean;
  injected: boolean;
};

type Palette = {
  ab: string;
  ba: string;
  err: string;
  muted: string;
  accent: string;
};

const THROTTLE_MS = 30;
const MAX_PARTICLES = 90;
const FULL_CIRCLE = Math.PI * 2;

const levelOf = (rate: number) =>
  rate <= 0.5 ? 0 : Math.max(0.18, Math.min(1, Math.log10(rate) / 4.7));

const endStateOf = (status: SideStatusName): EndState =>
  status === "error"
    ? "err"
    : status === "connected"
      ? "ok"
      : status === "idle" || status === "disabled"
        ? "idle"
        : "wait";

const readPalette = (): Palette => {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    ab: read("--ab"),
    ba: read("--ba"),
    err: read("--err"),
    muted: read("--fg-3"),
    accent: read("--accent-text"),
  };
};

export const attachParticleStream = (
  canvas: HTMLCanvasElement,
  profileName: string,
) => {
  const context = canvas.getContext("2d");
  if (!context) return () => undefined;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");

  let width = 0;
  let height = 0;
  let palette: Palette | null = null;
  let frameHandle = 0;
  let particles: Particle[] = [];
  const lastSpawn: Record<Direction, number> = { AB: 0, BA: 0 };
  const view = {
    running: false,
    a: "idle" as EndState,
    b: "idle" as EndState,
    targetAb: 0,
    targetBa: 0,
    ab: 0,
    ba: 0,
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width) return;
    const ratio = devicePixelRatio || 1;
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    kick();
  };

  const drawLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    alpha: number,
    lineWidth: number,
  ) => {
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
    context.restore();
  };

  const drawDot = (x: number, y: number, radius: number, color: string, alpha: number) => {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, FULL_CIRCLE);
    context.fill();
    context.restore();
  };

  const drawCut = (x: number, y: number, color: string) => {
    drawLine(x - 4, y - 8, x, y + 8, color, 0.95, 1.5);
    drawLine(x + 1, y - 8, x + 5, y + 8, color, 0.95, 1.5);
  };

  const drawStaticDots = (
    colors: Palette,
    xStart: number,
    xEnd: number,
    centerY: number,
    inset: number,
    gap: number,
  ) => {
    context.save();
    context.fillStyle = colors.muted;
    const guideStart = view.running ? xStart : inset;
    const guideEnd = view.running ? xEnd : width - inset;
    for (let x = guideStart; x <= guideEnd; x += 6) {
      const waiting =
        view.running &&
        ((view.a === "wait" && x < inset + gap) ||
          (view.b === "wait" && x > width - inset - gap));
      context.globalAlpha = view.running ? (waiting ? 0.15 : 0.4) : 0.45;
      context.fillRect(x, centerY - 0.6, 1.2, 1.2);
    }
    context.restore();
  };

  const drawReduced = (
    colors: Palette,
    xStart: number,
    xEnd: number,
    centerY: number,
  ) => {
    const lanes: [number, string, number][] = [
      [-1, colors.ab, levelOf(view.ab)],
      [1, colors.ba, levelOf(view.ba)],
    ];
    lanes.forEach(([sign, color, level]) => {
      if (!level) return;
      const count = Math.round(3 + level * 14);
      for (let index = 0; index < count; index += 1) {
        const x = xStart + ((xEnd - xStart) * (index + 0.5)) / count;
        drawDot(x, centerY + sign * (4 + (index % 3) * 2), 1.3, color, 0.35 + 0.5 * level);
      }
    });
  };

  const drawParticle = (
    particle: Particle,
    colors: Palette,
    now: number,
    xStart: number,
    xEnd: number,
    centerY: number,
  ) => {
    const progress = Math.min(1, (now - particle.startedAt) / particle.duration);
    const forward = particle.direction === "AB";
    const from = forward ? xStart : xEnd;
    const to = forward ? xEnd : xStart;
    const x = from + (to - from) * progress;
    let y = centerY + particle.offset * 7 + Math.sin(progress * 6 + particle.phase) * 1.2;
    let alpha =
      Math.min(1, progress / 0.15) *
      Math.min(1, (1 - progress) / 0.15) *
      (0.55 + 0.45 * levelOf(forward ? view.ab : view.ba));
    let color = particle.injected ? colors.accent : forward ? colors.ab : colors.ba;
    if (particle.dropped && progress > 0.45) {
      color = colors.err;
      y += (progress - 0.45) * 22;
      alpha *= Math.max(0, 1 - (progress - 0.45) * 2.2);
    }
    drawDot(x, y, 1 + Math.min(particle.size / 70, 1.5), color, alpha);
  };

  const draw = (now: number) => {
    const colors = (palette ??= readPalette());
    const centerY = height / 2;
    const inset = 6;
    const gap = width * 0.17;
    const xStart = view.a === "err" ? inset + gap : inset;
    const xEnd = view.b === "err" ? width - inset - gap : width - inset;
    drawStaticDots(colors, xStart, xEnd, centerY, inset, gap);
    if (!view.running) return;
    if (view.a === "err") drawCut(xStart - 7, centerY, colors.err);
    if (view.b === "err") drawCut(xEnd + 3, centerY, colors.err);
    if (motion.matches) return drawReduced(colors, xStart, xEnd, centerY);
    particles.forEach((particle) =>
      drawParticle(particle, colors, now, xStart, xEnd, centerY),
    );
  };

  const frame = (now: number) => {
    frameHandle = 0;
    if (!width) resize();
    if (!width) return;
    const smoothing = motion.matches ? 1 : 0.08;
    view.ab += (view.targetAb - view.ab) * smoothing;
    view.ba += (view.targetBa - view.ba) * smoothing;
    if (motion.matches) particles = [];
    context.clearRect(0, 0, width, height);
    draw(now);
    particles = particles.filter((particle) => now - particle.startedAt < particle.duration);
    const settling =
      Math.abs(view.ab - view.targetAb) > 1 || Math.abs(view.ba - view.targetBa) > 1;
    if (!document.hidden && (particles.length || settling)) {
      frameHandle = requestAnimationFrame(frame);
    }
  };

  function kick() {
    if (!frameHandle) frameHandle = requestAnimationFrame(frame);
  }

  const syncBridge = () => {
    const bridge = selectBridge(bridgeStore.getState(), profileName);
    view.running = bridge.running;
    view.a = endStateOf(bridge.sides.A.status);
    view.b = endStateOf(bridge.sides.B.status);
    view.targetAb = bridge.rates.ab;
    view.targetBa = bridge.rates.ba;
    if (!bridge.running) particles = [];
    kick();
  };

  const spawn = (event: RiftEvent) => {
    if (event.type !== "data" || event.origin !== "forwarded" || !event.delivered || event.profile !== profileName) return;
    if (!view.running || motion.matches) return;
    const direction: Direction = event.source === "A" ? "AB" : "BA";
    const now = performance.now();
    if (now - lastSpawn[direction] < THROTTLE_MS || particles.length >= MAX_PARTICLES) return;
    lastSpawn[direction] = now;
    particles.push({
      direction,
      startedAt: now,
      duration: 900 + Math.random() * 400,
      offset: (Math.random() * 0.8 + 0.2) * (direction === "AB" ? -1 : 1),
      phase: Math.random() * FULL_CIRCLE,
      size: event.bytes.length,
      dropped: !event.delivered,
      injected: false,
    });
    kick();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const stopBridge = bridgeStore.subscribe(syncBridge);
  const stopEvents = subscribeToEvents(spawn);
  const stopTheme = themeStore.subscribe(() => {
    palette = null;
    kick();
  });
  motion.addEventListener("change", kick);
  syncBridge();

  return () => {
    cancelAnimationFrame(frameHandle);
    observer.disconnect();
    stopBridge();
    stopEvents();
    stopTheme();
    motion.removeEventListener("change", kick);
  };
};
