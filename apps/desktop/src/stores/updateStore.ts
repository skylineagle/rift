import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

import { createStore } from "@/lib/createStore";
import { errorMessage } from "@/lib/format";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const RELEASES_URL = "https://github.com/skylineagle/rift/releases/latest";

export type UpdateState =
  | { status: "idle" }
  | { status: "ready"; version: string; notes: string }
  | { status: "installing"; version: string }
  | { status: "failed"; version: string; message: string };

export const updateStore = createStore<UpdateState>({ status: "idle" });

let downloaded: Update | null = null;

const checkForUpdate = async () => {
  if (updateStore.getState().status !== "idle") return;
  try {
    const update = await check();
    if (!update) return;
    await update.download();
    downloaded = update;
    updateStore.setState(() => ({ status: "ready", version: update.version, notes: update.body ?? "" }));
  } catch {
    downloaded = null;
  }
};

export const installUpdate = async () => {
  const update = downloaded;
  if (!update) return;
  updateStore.setState(() => ({ status: "installing", version: update.version }));
  try {
    await update.install();
    await relaunch();
  } catch (error) {
    updateStore.setState(() => ({ status: "failed", version: update.version, message: errorMessage(error) }));
  }
};

if (!import.meta.env.DEV) {
  checkForUpdate();
  setInterval(checkForUpdate, CHECK_INTERVAL_MS);
}
