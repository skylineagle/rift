import { beforeEach, expect, mock, test } from "bun:test";

import type { Profile } from "@/lib/types";

const calls: string[] = [];
const saved: Profile[] = [];
let failStart = false;
let failImport = false;
let startGate: Promise<void> | undefined;

mock.module("@/lib/tauriApi", () => ({
  listProfiles: async () => [],
  importConfig: async () => { calls.push("import"); if (failImport) throw new Error("import failed"); return [{ name: "imported", a: defaultEndpoint("tcp-server"), b: defaultEndpoint("udp-server") }]; },
  bridgeStatus: async () => [],
  saveProfile: async (_previous: string | null, profile: Profile) => {
    calls.push("save");
    saved.push(profile);
  },
  startProfile: async () => {
    calls.push("start");
    await startGate;
    if (failStart) throw new Error("start failed");
  },
  stopProfile: async () => { calls.push("stop"); },
  setSideEnabled: async (_name: string, side: string, enabled: boolean) => {
    calls.push(`${side}:${enabled}`);
    if (enabled && failStart) throw new Error("resume failed");
  },
}));
mock.module("@/stores/eventStream", () => ({
  subscribeToBatches: () => () => undefined,
  subscribeToEvents: () => () => undefined,
}));
mock.module("@yusufceng1z/ding-react", () => ({ toast: { error: () => undefined, info: () => undefined } }));

const { profilesStore, setSideEnabled, updateEndpoint, importConfig } = await import("@/stores/profilesStore");
const { bridgeStore, IDLE_BRIDGE } = await import("@/stores/bridgeStore");
const { defaultEndpoint } = await import("@/lib/endpointKinds");

beforeEach(() => {
  calls.length = 0;
  saved.length = 0;
  failStart = false;
  failImport = false;
  startGate = undefined;
  profilesStore.setState(() => ({
    loaded: true,
    selectedName: "test",
    staleNames: [],
    editedSides: [],
    pendingSides: [],
    profiles: [{ name: "test", a: defaultEndpoint("tcp-server"), b: defaultEndpoint("udp-server") }],
  }));
  bridgeStore.setState(() => ({ bridges: {} }));
});

test("playing either stopped side persists only that side before starting the backend", async () => {
  for (const side of ["A", "B"] as const) {
    bridgeStore.setState(() => ({ bridges: {} }));
    await setSideEnabled("test", side, true);
    const profile = saved.at(-1);
    expect(profile?.a.enabled).toBe(side === "A");
    expect(profile?.b.enabled).toBe(side === "B");
  }
  expect(calls).toEqual(["save", "start", "save", "start"]);
});

test("pausing one active side leaves the peer running", async () => {
  bridgeStore.setState(() => ({ bridges: { test: {
    ...IDLE_BRIDGE,
    running: true,
    sides: {
      A: { status: "connected", peers: ["peer"], detail: "" },
      B: { status: "listening", peers: [], detail: "" },
    },
  } } }));
  await setSideEnabled("test", "B", false);
  expect(calls).toEqual(["B:false", "save"]);
  expect(saved[0].a.enabled).toBe(true);
  expect(saved[0].b.enabled).toBe(false);
  expect(bridgeStore.getState().bridges.test.running).toBe(true);
});

test("pausing the last active side stops the empty bridge", async () => {
  bridgeStore.setState(() => ({ bridges: { test: {
    ...IDLE_BRIDGE,
    running: true,
    sides: {
      A: { status: "listening", peers: [], detail: "" },
      B: { status: "disabled", peers: [], detail: "" },
    },
  } } }));
  await setSideEnabled("test", "A", false);
  expect(calls).toEqual(["A:false", "save", "stop"]);
  expect(bridgeStore.getState().bridges.test.running).toBe(false);
});

test("failed startup restores stopped runtime and clears pending state", async () => {
  failStart = true;
  await setSideEnabled("test", "A", true);
  expect(bridgeStore.getState().bridges.test.running).toBe(false);
  expect(profilesStore.getState().pendingSides).toEqual([]);
});

test("resuming a paused side saves edits then starts only that side", async () => {
  bridgeStore.setState(() => ({ bridges: { test: {
    ...IDLE_BRIDGE,
    running: true,
    sides: {
      A: { status: "connected", peers: ["peer"], detail: "" },
      B: { status: "disabled", peers: [], detail: "" },
    },
  } } }));
  await setSideEnabled("test", "B", true);
  expect(calls).toEqual(["save", "B:true"]);
  expect(saved[0].a.enabled).toBe(true);
  expect(saved[0].b.enabled).toBe(true);
  expect(bridgeStore.getState().bridges.test.sides.A.peers).toEqual(["peer"]);
});

test("overlapping lifecycle commands are serialized per profile", async () => {
  await Promise.all([
    setSideEnabled("test", "A", true),
    setSideEnabled("test", "B", true),
  ]);
  expect(calls).toEqual(["save", "start"]);
  expect(profilesStore.getState().pendingSides).toEqual([]);
});

test("receive and forward events count each byte once and injection only counts successful sends", async () => {
  const { applyEvent } = await import("@/stores/bridgeStore");
  let bridge = { ...IDLE_BRIDGE, running: true };
  for (const source of ["A", "B"] as const) {
    const target = source === "A" ? "B" : "A";
    for (const origin of ["received", "forwarded"] as const) {
      bridge = applyEvent(bridge, {
        type: "data", profile: "test", timestamp: new Date().toISOString(),
        source, target, origin, bytes: [1, 2, 3], delivered: true,
      });
    }
  }
  expect(bridge.counters).toEqual({ A: { received: 3, sent: 3 }, B: { received: 3, sent: 3 } });
  for (const delivered of [false, true]) {
    bridge = applyEvent(bridge, {
      type: "data", profile: "test", timestamp: new Date().toISOString(),
      source: "A", target: "B", origin: "injected", bytes: [1, 2], delivered,
    });
  }
  expect(bridge.counters).toEqual({ A: { received: 3, sent: 3 }, B: { received: 3, sent: 5 } });
});

const settleEdits = async () => {
  while (profilesStore.getState().pendingSides.length) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

const runningPair = () => bridgeStore.setState(() => ({ bridges: { test: {
  ...IDLE_BRIDGE,
  running: true,
  sides: {
    A: { status: "listening", peers: [], detail: "" },
    B: { status: "connected", peers: ["peer"], detail: "" },
  },
} } }));

test("editing a running endpoint pauses only that side and preserves peer runtime", async () => {
  runningPair();
  bridgeStore.setState((state) => ({ bridges: { ...state.bridges, test: { ...state.bridges.test,
    counters: { A: { received: 12, sent: 4 }, B: { received: 8, sent: 6 } },
    sideRates: { A: { received: 2, sent: 1 }, B: { received: 3, sent: 4 } },
  } } }));
  const peer = bridgeStore.getState().bridges.test.sides.B;
  updateEndpoint("test", "A", { kind: "tcp-server", enabled: true, bind: "localhost:42", max_clients: null, no_delay: true });
  await settleEdits();
  expect(calls).toEqual(["A:false", "save"]);
  expect(bridgeStore.getState().bridges.test.counters).toEqual({ A: { received: 0, sent: 0 }, B: { received: 8, sent: 6 } });
  expect(bridgeStore.getState().bridges.test.sideRates).toEqual({ A: { received: 0, sent: 0 }, B: { received: 3, sent: 4 } });
  expect(bridgeStore.getState().bridges.test.sides.B).toBe(peer);
  expect(profilesStore.getState().editedSides).toEqual(["test:A"]);
});

test("paused edits mark edited, no-op changes do nothing, and Play saves latest fields", async () => {
  const endpoint = profilesStore.getState().profiles[0].a;
  updateEndpoint("test", "A", { ...endpoint });
  expect(profilesStore.getState().editedSides).toEqual([]);
  updateEndpoint("test", "A", { kind: "uart", enabled: true, port: "/dev/latest", baud_rate: 9600, data_bits: 8, parity: "none", stop_bits: 1, flow_control: "none" });
  expect(calls).toEqual([]);
  expect(profilesStore.getState().editedSides).toEqual(["test:A"]);
  await setSideEnabled("test", "A", true);
  expect(saved.at(-1)?.a).toMatchObject({ kind: "uart", port: "/dev/latest", baud_rate: 9600 });
  expect(profilesStore.getState().editedSides).toEqual([]);
});

test("failed Play keeps the edited indication", async () => {
  updateEndpoint("test", "A", defaultEndpoint("tcp-client"));
  failStart = true;
  await setSideEnabled("test", "A", true);
  expect(profilesStore.getState().editedSides).toEqual(["test:A"]);
});

test("rapid edits during startup survive completion and pause the newly started side", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  startGate = gate;
  const start = setSideEnabled("test", "A", true);
  while (!calls.includes("start")) await new Promise((resolve) => setTimeout(resolve, 1));
  const endpoint = { kind: "tcp-client", enabled: true, address: "", reconnect_delay_ms: 1000, connect_timeout_ms: 5000, no_delay: true } as const;
  updateEndpoint("test", "A", { ...endpoint, address: "first:1" });
  updateEndpoint("test", "A", { ...endpoint, address: "latest:2" });
  release?.();
  await gate;
  await start;
  await settleEdits();
  expect(profilesStore.getState().profiles[0].a).toMatchObject({ address: "latest:2", enabled: false });
  expect(profilesStore.getState().editedSides).toEqual(["test:A"]);
  expect(calls.filter((call) => call === "A:false")).toHaveLength(1);
});

test("failed resume keeps the marker and the peer connected", async () => {
  runningPair();
  updateEndpoint("test", "A", defaultEndpoint("udp-client"));
  await settleEdits();
  failStart = true;
  await setSideEnabled("test", "A", true);
  expect(profilesStore.getState().editedSides).toEqual(["test:A"]);
  expect(bridgeStore.getState().bridges.test.sides.B.peers).toEqual(["peer"]);
  expect(bridgeStore.getState().bridges.test.sides.A.status).toBe("disabled");
});

test("every endpoint field participates in edit detection on either paused side", () => {
  const endpoints = [
    { kind: "tcp-client", enabled: true, address: "host:1", reconnect_delay_ms: 1, connect_timeout_ms: 1, no_delay: true },
    { kind: "tcp-server", enabled: true, bind: "host:1", max_clients: 1, no_delay: true },
    { kind: "udp-client", enabled: true, remote: "host:1", bind: "local:2" },
    { kind: "udp-server", enabled: true, bind: "host:1", reply_to: "all", peer_timeout_secs: 1 },
    { kind: "uart", enabled: true, port: "/dev/port", baud_rate: 9600, data_bits: 8, parity: "none", stop_bits: 1, flow_control: "none" },
  ] satisfies import("@/lib/types").Endpoint[];
  for (const endpoint of endpoints) {
    for (const [field, value] of Object.entries(endpoint)) {
      if (field === "enabled") continue;
      for (const side of ["A", "B"] as const) {
        const property = side === "A" ? "a" : "b";
        profilesStore.setState((state) => ({
          ...state,
          editedSides: [],
          profiles: state.profiles.map((profile) => ({ ...profile, [property]: endpoint })),
        }));
        const changed = typeof value === "boolean" ? !value : typeof value === "number" ? value + 1 : `${value}-edited`;
        const next = field === "kind" ? defaultEndpoint(endpoint.kind === "uart" ? "tcp-client" : "uart") : { ...endpoint, [field]: changed };
        updateEndpoint("test", side, next);
        expect(profilesStore.getState().editedSides).toEqual([`test:${side}`]);
      }
    }
  }
  expect(calls).toEqual([]);
});


test("import updates only after a successful batch and never starts a bridge", async () => {
  failImport = true;
  expect(await importConfig("bad", "bad.toml")).toBe(false);
  expect(profilesStore.getState().profiles.map((profile) => profile.name)).toEqual(["test"]);
  failImport = false;
  expect(await importConfig("valid", "rift.toml")).toBe(true);
  expect(profilesStore.getState().profiles.map((profile) => profile.name)).toEqual(["test", "imported"]);
  expect(calls).toEqual(["import", "import"]);
  expect(bridgeStore.getState().bridges.imported).toBeUndefined();
});
