import { createStore } from "@/lib/createStore";
import * as api from "@/lib/tauriApi";
import {
  IDLE_SIDE,
  nextSideRuntime,
  type SideRuntime,
} from "@/lib/sideStatus";
import type {
  BridgeStatus,
  RiftEvent,
  SideName,
  SideStatus,
} from "@/lib/types";
import { subscribeToBatches } from "@/stores/eventStream";

export type SideCounters = { received: number; sent: number };

export type BridgeRuntime = {
  running: boolean;
  sides: Record<SideName, SideRuntime>;
  counters: Record<SideName, SideCounters>;
  rates: { ab: number; ba: number };
  sideRates: Record<SideName, SideCounters>;
};

export const IDLE_BRIDGE: BridgeRuntime = {
  running: false,
  sides: { A: IDLE_SIDE, B: IDLE_SIDE },
  counters: {
    A: { received: 0, sent: 0 },
    B: { received: 0, sent: 0 },
  },
  rates: { ab: 0, ba: 0 },
  sideRates: { A: { received: 0, sent: 0 }, B: { received: 0, sent: 0 } },
};

type BridgeState = { bridges: Record<string, BridgeRuntime> };

export const bridgeStore = createStore<BridgeState>({ bridges: {} });

export const selectBridge = (state: BridgeState, name: string) =>
  state.bridges[name] ?? IDLE_BRIDGE;

type RateKey = "ab" | "ba" | "A.received" | "A.sent" | "B.received" | "B.sent";
type RateSample = { timestamp: number; size: number; direction: RateKey };
const rateKeys: RateKey[] = ["ab", "ba", "A.received", "A.sent", "B.received", "B.sent"];
const pausedSides = new Map<string, Partial<Record<SideName, number>>>();

const RATE_WINDOW_MS = 1000;
const RATE_IDLE_MS = 5000;
const rateSamples = new Map<string, RateSample[]>();
const lastActivity = new Map<string, Partial<Record<RateKey, number>>>();
let rateTimer: ReturnType<typeof setTimeout> | undefined;

const updateBridge = (
  name: string,
  update: (bridge: BridgeRuntime) => BridgeRuntime,
) =>
  bridgeStore.setState((state) => {
    const current = selectBridge(state, name);
    const next = update(current);
    return next === current
      ? state
      : { bridges: { ...state.bridges, [name]: next } };
  });

export const applyEvent = (bridge: BridgeRuntime, event: RiftEvent): BridgeRuntime => {
  if (!bridge.running) return bridge;
  if (event.type === "status") {
    return {
      ...bridge,
      sides: {
        ...bridge.sides,
        [event.side]: nextSideRuntime(bridge.sides[event.side], event.state),
      },
    };
  }
  const size = event.bytes.length;
  const source = bridge.counters[event.source];
  const target = bridge.counters[event.target];
  return {
    ...bridge,
    counters: {
      ...bridge.counters,
      [event.source]:
        event.origin === "received"
          ? { ...source, received: source.received + size }
          : source,
      [event.target]: event.origin !== "received" && event.delivered
        ? { ...target, sent: target.sent + size }
        : target,
    },
  };
};

const recordRate = (event: RiftEvent) => {
  if (event.type !== "data" || (event.origin !== "received" && !event.delivered)) return;
  if (!selectBridge(bridgeStore.getState(), event.profile).running || event.bytes.length === 0) return;
  const side = event.origin === "received" ? event.source : event.target;
  const boundary = pausedSides.get(event.profile)?.[side];
  if (boundary !== undefined && (boundary === Infinity || Date.parse(event.timestamp) < boundary)) return;
  const direction: RateKey = `${side}.${event.origin === "received" ? "received" : "sent"}`;
  const directions: RateKey[] = event.origin === "received" ? [direction] : [direction, event.source === "A" ? "ab" : "ba"];
  const samples = rateSamples.get(event.profile) ?? [];
  const timestamp = performance.now();
  for (const key of directions) {
    samples.push({ timestamp, size: event.bytes.length, direction: key });
    lastActivity.set(event.profile, { ...lastActivity.get(event.profile), [key]: timestamp });
  }
  rateSamples.set(event.profile, samples);
};

subscribeToBatches((events) => {
  events.forEach(recordRate);
  bridgeStore.setState((state) => {
    let bridges = state.bridges;
    for (const event of events) {
      if (event.type === "data") {
        const side = event.origin === "received" ? event.source : event.target;
        const boundary = pausedSides.get(event.profile)?.[side];
        if (boundary !== undefined && (boundary === Infinity || Date.parse(event.timestamp) < boundary)) continue;
      }
      const current = selectBridge({ bridges }, event.profile);
      const next = applyEvent(current, event);
      if (next !== current) bridges = { ...bridges, [event.profile]: next };
    }
    return bridges === state.bridges ? state : { bridges };
  });
  if (rateSamples.size > 0 && rateTimer === undefined) {
    scheduleRates();
  }
});

const measureRates = (name: string) => {
  const now = performance.now();
  const samples = (rateSamples.get(name) ?? []).filter(
    (sample) => now - sample.timestamp <= RATE_WINDOW_MS,
  );
  rateSamples.set(name, samples);
  const previous = selectBridge(bridgeStore.getState(), name);
  const old: Record<RateKey, number> = {
    ...previous.rates,
    "A.received": previous.sideRates.A.received, "A.sent": previous.sideRates.A.sent,
    "B.received": previous.sideRates.B.received, "B.sent": previous.sideRates.B.sent,
  };
  const activity = lastActivity.get(name);
  const result = Object.fromEntries(rateKeys.map((key) => {
    const last = activity?.[key];
    const measured = samples.filter((sample) => sample.direction === key).reduce((sum, sample) => sum + sample.size, 0);
    return [key, last === undefined || now - last >= RATE_IDLE_MS ? 0 : measured || old[key]];
  })) as Record<RateKey, number>;
  return result;
};

const scheduleRates = () => {
  const now = performance.now();
  const deadlines = [...lastActivity.values()].flatMap((activity) =>
    Object.values(activity).filter((timestamp) => now - timestamp < RATE_IDLE_MS)
      .map((timestamp) => timestamp + RATE_IDLE_MS - now),
  );
  rateTimer = setTimeout(refreshRates, Math.min(250, ...deadlines));
};

const refreshRates = () => {
  rateTimer = undefined;
  for (const name of rateSamples.keys()) {
    const rates = measureRates(name);
    updateBridge(name, (bridge) => ({
      ...bridge,
      rates: { ab: rates.ab, ba: rates.ba },
      sideRates: {
        A: { received: rates["A.received"], sent: rates["A.sent"] },
        B: { received: rates["B.received"], sent: rates["B.sent"] },
      },
    }));
    if (rateKeys.every((key) => rates[key] === 0)) {
      rateSamples.delete(name);
      lastActivity.delete(name);
    }
  }
  if (rateSamples.size > 0) scheduleRates();
};

export const pauseSide = (name: string, side: SideName) => {
  pausedSides.set(name, { ...pausedSides.get(name), [side]: Infinity });
  const keys: RateKey[] = [`${side}.received`, `${side}.sent`];
  rateSamples.set(name, (rateSamples.get(name) ?? []).filter((sample) => !keys.includes(sample.direction)));
  const activity = { ...lastActivity.get(name) };
  keys.forEach((key) => delete activity[key]);
  lastActivity.set(name, activity);
  updateBridge(name, (bridge) => ({ ...bridge,
    counters: { ...bridge.counters, [side]: { received: 0, sent: 0 } },
    sideRates: { ...bridge.sideRates, [side]: { received: 0, sent: 0 } },
    sides: { ...bridge.sides, [side]: { ...IDLE_SIDE, status: "disabled" } },
  }));
};

export const resumeSide = (name: string, side: SideName) => {
  pausedSides.set(name, { ...pausedSides.get(name), [side]: Date.now() });
};

export const markRunning = (name: string) =>
  updateBridge(name, (bridge) =>
    bridge.running ? bridge : { ...IDLE_BRIDGE, running: true },
  );

export const markStopped = (name: string) => {
  rateSamples.delete(name);
  lastActivity.delete(name);
  pausedSides.delete(name);
  if (rateSamples.size === 0 && rateTimer !== undefined) {
    clearTimeout(rateTimer);
    rateTimer = undefined;
  }
  updateBridge(name, () => IDLE_BRIDGE);
};

const sideFromStatus = (status: SideStatus): SideRuntime =>
  nextSideRuntime(
    {
      ...IDLE_SIDE,
      peers:
        status.state.state === "connected" && status.peers > 0
          ? [status.state.peer]
          : [],
    },
    status.state,
  );

const hydrateBridge = (status: BridgeStatus) =>
  updateBridge(status.profile, () => ({
    ...IDLE_BRIDGE,
    running: true,
    sides: { A: sideFromStatus(status.a), B: sideFromStatus(status.b) },
  }));

api
  .bridgeStatus()
  .then((statuses) => statuses.forEach(hydrateBridge))
  .catch(() => undefined);
