import { invoke } from "@tauri-apps/api/core";

import type {
  BridgeStatus,
  PayloadFormat,
  Profile,
  SerialPortInfo,
  SideName,
  Target,
} from "@/lib/types";

export const listProfiles = () => invoke<Profile[]>("list_profiles");

export const prepareConfigImport = (content: string, filename: string, existingNames: string[]) =>
  invoke<Profile[]>("prepare_config_import", { content, filename, existingNames });

export const importConfig = (content: string, filename: string) =>
  invoke<Profile[]>("import_config", { content, filename });

export const readConfigFile = (path: string) => invoke<string>("read_config_file", { path });

export const saveProfile = (previousName: string | null, profile: Profile) =>
  invoke<void>("save_profile", { previousName, profile });

export const deleteProfile = (name: string) =>
  invoke<void>("delete_profile", { name });

export const startProfile = (name: string) =>
  invoke<void>("start_profile", { name });

export const stopProfile = (name: string) =>
  invoke<void>("stop_profile", { name });

export const restartProfile = (name: string) =>
  invoke<void>("restart_profile", { name });

export const setSideEnabled = (name: string, side: SideName, enabled: boolean) =>
  invoke<void>("set_side_enabled", { name, side, enabled });

export const runningProfiles = () => invoke<string[]>("running_profiles");

export const bridgeStatus = () => invoke<BridgeStatus[]>("bridge_status");

export const inject = (
  name: string,
  target: Target,
  format: PayloadFormat,
  input: string,
) => invoke<void>("inject", { name, target, format, input });

export const listPorts = () => invoke<SerialPortInfo[]>("list_ports");

export const exportLog = (path: string, content: string) =>
  invoke<void>("export_log", { path, content });

export const previewPayload = (format: PayloadFormat, input: string) =>
  invoke<number[]>("preview_payload", { format, input });
