import { toast } from "@yusufceng1z/ding-react";

import { errorMessage } from "@/lib/format";
import { readConfigFile } from "@/lib/tauriApi";
import { importConfig } from "@/stores/profilesStore";

const maxConfigBytes = 1024 * 1024;

const runImport = async (load: () => Promise<string>, filename: string) => {
  try {
    await importConfig(await load(), filename);
  } catch (error) {
    toast.error(errorMessage(error));
  }
};

export const importConfigFile = (file: File) => {
  if (file.size > maxConfigBytes) {
    toast.error("Configuration exceeds the 1 MiB import limit");
    return;
  }
  void runImport(() => file.text(), file.name);
};

export const importConfigPath = (path: string) =>
  void runImport(() => readConfigFile(path), path.split(/[\\/]/).pop() ?? path);

export const rejectMultipleFiles = () => toast.error("Drop one configuration file at a time");
