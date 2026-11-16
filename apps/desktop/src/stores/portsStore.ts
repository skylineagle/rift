import { toast } from "@yusufceng1z/ding-react";

import { createStore } from "@/lib/createStore";
import { errorMessage } from "@/lib/format";
import { listPorts } from "@/lib/tauriApi";
import type { SerialPortInfo } from "@/lib/types";

export const portsStore = createStore<SerialPortInfo[]>([]);

export const rescanPorts = async (announce: boolean) => {
  try {
    const ports = await listPorts();
    portsStore.setState(() => ports);
    if (announce) toast.info(`Found ${ports.length} serial port${ports.length === 1 ? "" : "s"}`);
  } catch (error) {
    toast.error(errorMessage(error));
  }
};

rescanPorts(false);
