import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "@yusufceng1z/ding-react";

import { errorMessage, formatInteger } from "@/lib/format";
import { rowToText, type LogRow } from "@/lib/logRows";
import { exportLog } from "@/lib/tauriApi";

const fileNameFor = (profileName: string) =>
  `rift-${profileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.log`;

export const exportRows = async (profileName: string, rows: LogRow[]) => {
  try {
    const path = await save({ defaultPath: fileNameFor(profileName) });
    if (!path) return;
    await exportLog(path, rows.map(rowToText).join("\n"));
    toast.info(`Exported ${formatInteger(rows.length)} events`);
  } catch (error) {
    toast.error(errorMessage(error));
  }
};
