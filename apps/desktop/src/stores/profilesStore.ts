import { toast } from "@yusufceng1z/ding-react";

import { createStore } from "@/lib/createStore";
import { defaultEndpoint, switchEndpointKind } from "@/lib/endpointKinds";
import { errorMessage } from "@/lib/format";
import { statusRow } from "@/lib/logRows";
import * as api from "@/lib/tauriApi";
import type { Endpoint, EndpointKind, Profile, SideName } from "@/lib/types";
import { markRunning, markStopped, pauseSide, resumeSide, bridgeStore } from "@/stores/bridgeStore";
import { appendLocalRow } from "@/stores/logStore";

type ProfilesState = {
  loaded: boolean;
  profiles: Profile[];
  selectedName: string | null;
  staleNames: string[];
  pendingSides: string[];
  editedSides: string[];
};

export const profilesStore = createStore<ProfilesState>({
  loaded: false,
  profiles: [],
  selectedName: null,
  staleNames: [],
  pendingSides: [],
  editedSides: [],
});

const SAVE_DELAY_MS = 400;
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

const reportError = (error: unknown) => toast.error(errorMessage(error));

const findProfile = (name: string) =>
  profilesStore.getState().profiles.find((profile) => profile.name === name);

const isRunning = (name: string) =>
  bridgeStore.getState().bridges[name]?.running ?? false;

const replaceProfile = (name: string, profile: Profile) =>
  profilesStore.setState((state) => ({
    ...state,
    profiles: state.profiles.map((candidate) =>
      candidate.name === name ? profile : candidate,
    ),
  }));

const clearStale = (name: string) =>
  profilesStore.setState((state) => ({
    ...state,
    staleNames: state.staleNames.filter((candidate) => candidate !== name),
  }));

const pendingCounts = new Map<string, number>();
const actions = new Map<string, Promise<void>>();
const editPauses = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
const saves = new Map<string, Promise<void>>();

const saveProfile = (profile: Profile, previousName: string | null = null) => {
  const previous = saves.get(profile.name) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => api.saveProfile(previousName, profile));
  saves.set(profile.name, next);
  return next;
};

const persistNow = (profile: Profile, previousName: string | null = null) => {
  clearTimeout(pendingSaves.get(profile.name));
  pendingSaves.delete(profile.name);
  return saveProfile(profile, previousName);
};

const persistSoon = (name: string) => {
  clearTimeout(pendingSaves.get(name));
  pendingSaves.set(
    name,
    setTimeout(() => {
      pendingSaves.delete(name);
      const profile = findProfile(name);
      if (profile) saveProfile(profile).catch(reportError);
    }, SAVE_DELAY_MS),
  );
};

const uniqueName = (base: string) => {
  const names = new Set(profilesStore.getState().profiles.map(({ name }) => name));
  if (!names.has(base)) return base;
  let counter = 2;
  while (names.has(`${base} ${counter}`)) counter += 1;
  return `${base} ${counter}`;
};

export const loadProfiles = async () => {
  try {
    const profiles = await api.listProfiles();
    profilesStore.setState((state) => ({
      ...state,
      loaded: true,
      profiles,
      selectedName: state.selectedName ?? profiles[0]?.name ?? null,
    }));
  } catch (error) {
    profilesStore.setState((state) => ({ ...state, loaded: true }));
    reportError(error);
  }
};

loadProfiles();

export const importConfig = async (content: string, filename: string) => {
  try {
    const profiles = await api.importConfig(content, filename);
    profilesStore.setState((state) => ({ ...state, profiles: [...state.profiles, ...profiles], selectedName: state.selectedName ?? profiles[0]?.name ?? null }));
    toast.info(`Imported ${profiles.length} ${profiles.length === 1 ? "profile" : "profiles"}`);
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
};

export const selectProfile = (name: string) =>
  profilesStore.setState((state) => ({ ...state, selectedName: name }));

const sideEnabled = (name: string, side: SideName) => {
  const bridge = bridgeStore.getState().bridges[name];
  return !!bridge?.running && !["disabled", "idle"].includes(bridge.sides[side].status);
};

const runSideAction = (name: string, side: SideName, enabled: boolean) => {
  const key = `${name}:${side}`;
  const previous = actions.get(name) ?? Promise.resolve();
  pendingCounts.set(key, (pendingCounts.get(key) ?? 0) + 1);
  profilesStore.setState((state) => ({
    ...state,
    pendingSides: state.pendingSides.includes(key) ? state.pendingSides : [...state.pendingSides, key],
  }));
  const action = previous.catch(() => undefined).then(async () => {
    const profile = findProfile(name);
    if (!profile) return;
    const revision = revisions.get(key);
    const opposite = side === "A" ? "B" : "A";
    const oppositeEnabled = sideEnabled(name, opposite);
    const wasRunning = isRunning(name);
    const next = {
      ...profile,
      a: { ...profile.a, enabled: side === "A" ? enabled : oppositeEnabled },
      b: { ...profile.b, enabled: side === "B" ? enabled : oppositeEnabled },
    };
    try {
      if (!enabled && wasRunning) {
        await api.setSideEnabled(name, side, false);
        pauseSide(name, side);
      }
      await persistNow(next);
      if (enabled) {
        resumeSide(name, side);
        if (!wasRunning) {
          markRunning(name);
          await api.startProfile(name);
        } else {
          await api.setSideEnabled(name, side, true);
        }
      }
      bridgeStore.setState((state) => {
        const bridge = state.bridges[name];
        if (!bridge) return state;
        return { bridges: { ...state.bridges, [name]: {
          ...bridge,
          sides: { ...bridge.sides, [side]: enabled
            ? bridge.sides[side].status === "idle" || bridge.sides[side].status === "disabled"
              ? { status: "connecting", peers: [], detail: "" }
              : bridge.sides[side]
            : { status: "disabled", peers: [], detail: "" } },
        } } };
      });
      const latest = findProfile(name);
      if (latest) replaceProfile(name, {
        ...latest,
        a: { ...latest.a, enabled: next.a.enabled },
        b: { ...latest.b, enabled: next.b.enabled },
      });
      if (enabled && revisions.get(key) === revision && !editPauses.has(key)) {
        profilesStore.setState((state) => ({
          ...state,
          editedSides: state.editedSides.filter((candidate) => candidate !== key),
        }));
      }
      if (!enabled && !oppositeEnabled && wasRunning) {
        await api.stopProfile(name);
        markStopped(name);
      }
    } catch (error) {
      if (!wasRunning) markStopped(name);
      else if (enabled) pauseSide(name, side);
      reportError(error);
    }
  });
  actions.set(name, action);
  void action.finally(() => {
    if (actions.get(name) === action) actions.delete(name);
    const count = (pendingCounts.get(key) ?? 1) - 1;
    if (count > 0) pendingCounts.set(key, count);
    else {
      pendingCounts.delete(key);
      profilesStore.setState((state) => ({
        ...state,
        pendingSides: state.pendingSides.filter((candidate) => candidate !== key),
      }));
    }
  });
  return action;
};

export const updateEndpoint = (name: string, side: SideName, endpoint: Endpoint) => {
  const profile = findProfile(name);
  if (!profile) return;
  const current = side === "A" ? profile.a : profile.b;
  const currentFields = Object.entries(current);
  const nextFields = Object.entries(endpoint);
  if (currentFields.length === nextFields.length && currentFields.every(([key, value]) => nextFields.some(([nextKey, nextValue]) => key === nextKey && value === nextValue))) return;
  const key = `${name}:${side}`;
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
  replaceProfile(name, { ...profile, [side === "A" ? "a" : "b"]: endpoint });
  profilesStore.setState((state) => ({
    ...state,
    editedSides: state.editedSides.includes(key) ? state.editedSides : [...state.editedSides, key],
  }));
  persistSoon(name);
  if ((sideEnabled(name, side) || actions.has(name)) && !editPauses.has(key)) {
    const pause = runSideAction(name, side, false);
    editPauses.set(key, pause);
    void pause.finally(() => editPauses.delete(key));
  }
};

export const setSideEnabled = async (name: string, side: SideName, enabled: boolean) => {
  if (profilesStore.getState().pendingSides.some((key) => key.startsWith(`${name}:`))) return;
  await runSideAction(name, side, enabled);
};

export const changeEndpointKind = (name: string, side: SideName, kind: EndpointKind) => {
  const profile = findProfile(name);
  if (!profile) return;
  const current = side === "A" ? profile.a : profile.b;
  updateEndpoint(name, side, switchEndpointKind(current, kind));
};

export const renameProfile = async (name: string, nextName: string) => {
  const trimmed = nextName.trim();
  const profile = findProfile(name);
  if (!profile || trimmed === name) return false;
  if (!trimmed) { toast.error("Profile name cannot be empty"); return false; }
  if (findProfile(trimmed)) { toast.error("A profile with that name already exists"); return false; }
  if (isRunning(name)) {
    toast.info("Stop the bridge before renaming it");
    return false;
  }
  clearTimeout(pendingSaves.get(name));
  pendingSaves.delete(name);
  try {
    await persistNow({ ...profile, name: trimmed }, name);
    profilesStore.setState((state) => ({
      ...state,
      profiles: state.profiles.map((candidate) =>
        candidate.name === name ? { ...candidate, name: trimmed } : candidate,
      ),
      selectedName: state.selectedName === name ? trimmed : state.selectedName,
    }));
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
};

export const createProfile = async () => {
  const profile: Profile = {
    name: uniqueName("Untitled bridge"),
    a: defaultEndpoint("tcp-server"),
    b: defaultEndpoint("uart"),
  };
  try {
    await persistNow(profile);
    profilesStore.setState((state) => ({
      ...state,
      profiles: [...state.profiles, profile],
      selectedName: profile.name,
    }));
  } catch (error) {
    reportError(error);
  }
};

export const duplicateProfile = async (name: string) => {
  const profile = findProfile(name);
  if (!profile) return;
  const copy: Profile = { ...structuredClone(profile), name: uniqueName(`${name} copy`) };
  try {
    await persistNow(copy);
    profilesStore.setState((state) => {
      const index = state.profiles.findIndex((candidate) => candidate.name === name);
      const profiles = [...state.profiles];
      profiles.splice(index + 1, 0, copy);
      return { ...state, profiles, selectedName: copy.name };
    });
    toast.info(`Duplicated as “${copy.name}”, stopped`);
  } catch (error) {
    reportError(error);
  }
};

const restoreProfile = async (profile: Profile, index: number) => {
  try {
    await persistNow(profile);
    profilesStore.setState((state) => {
      const profiles = [...state.profiles];
      profiles.splice(index, 0, profile);
      return { ...state, profiles, selectedName: profile.name };
    });
  } catch (error) {
    reportError(error);
  }
};

export const deleteProfile = async (name: string) => {
  const { profiles } = profilesStore.getState();
  const index = profiles.findIndex((candidate) => candidate.name === name);
  const profile = profiles[index];
  if (!profile) return;
  try {
    await api.deleteProfile(name);
    markStopped(name);
    clearStale(name);
    profilesStore.setState((state) => {
      const remaining = state.profiles.filter((candidate) => candidate.name !== name);
      return {
        ...state,
        profiles: remaining,
        selectedName: remaining[Math.min(index, remaining.length - 1)]?.name ?? null,
      };
    });
    toast.info(`Deleted “${name}”`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          restoreProfile(profile, index);
          return { title: "Restored", action: null };
        },
      },
    });
  } catch (error) {
    reportError(error);
  }
};

export const restartBridge = async (name: string) => {
  clearStale(name);
  markStopped(name);
  markRunning(name);
  try {
    await api.restartProfile(name);
    appendLocalRow(name, statusRow(null, "ok", "bridge restarted"));
  } catch (error) {
    markStopped(name);
    reportError(error);
  }
};
