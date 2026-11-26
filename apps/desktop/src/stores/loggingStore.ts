import { createStore } from "@/lib/createStore";
import * as api from "@/lib/tauriApi";
import type { LoggingConfig } from "@/lib/types";

export const loggingStore = createStore<LoggingConfig | null>(null);

export const refreshLoggingConfig = async () => {
  const config = await api.getLoggingConfig();
  loggingStore.setState(() => config);
  return config;
};

export const saveLoggingSettings = async (config: LoggingConfig) => {
  await api.saveLoggingConfig(config);
  loggingStore.setState(() => config);
};

refreshLoggingConfig().catch(() => undefined);
