import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "@yusufceng1z/ding-react";
import { Download } from "lucide-react";
import { useCallback, useRef, useState, type FC } from "react";

import { errorMessage } from "@/lib/format";
import { readConfigFile } from "@/lib/tauriApi";
import { cn } from "@/lib/utils";
import { importConfig } from "@/stores/profilesStore";

export const ConfigImport: FC = () => {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const importFile = async (file: File) => {
    if (file.size > 1024 * 1024) { toast.error("Configuration exceeds the 1 MiB import limit"); return; }
    try { await importConfig(await file.text(), file.name); } catch (error) { toast.error(errorMessage(error)); }
  };
  const attach = useCallback((element: HTMLDivElement | null) => {
    if (!element || !isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onDragDropEvent(async ({ payload }) => {
      if (payload.type === "leave") { setOver(false); return; }
      const rect = element.getBoundingClientRect();
      const x = payload.position.x / window.devicePixelRatio;
      const y = payload.position.y / window.devicePixelRatio;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      setOver(inside && payload.type !== "drop");
      if (payload.type !== "drop" || !inside) return;
      if (payload.paths.length !== 1) { toast.error("Drop one configuration file at a time"); return; }
      const path = payload.paths[0];
      try { await importConfig(await readConfigFile(path), path.split(/[\\/]/).pop() ?? path); } catch (error) { toast.error(errorMessage(error)); }
    }).then((stop) => { if (disposed) stop(); else unlisten = stop; }).catch((error: unknown) => toast.error(errorMessage(error)));
    return () => { disposed = true; unlisten?.(); };
  }, []);

  return <div ref={attach} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
    onDrop={(event) => { event.preventDefault(); setOver(false); if (isTauri()) return; if (event.dataTransfer.files.length !== 1) { toast.error("Drop one configuration file at a time"); return; } void importFile(event.dataTransfer.files[0]); }}
    className={cn("m-1.5 rounded-lg border border-line-2 bg-surface-3 p-2 text-center text-[11px] text-fg-3", over && "border-accent-line bg-surface-4")}>
    <button className="flex w-full items-center justify-center gap-1 text-fg-2" onClick={() => input.current?.click()}><Download className="size-3" />{over ? "Release to import" : "Import configuration"}</button>
    <span>{over ? "Detecting configuration format" : "Drop a config file"}</span>
    <input ref={input} type="file" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} />
  </div>;
};
