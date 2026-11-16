import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, type DragDropEvent } from "@tauri-apps/api/window";
import { toast } from "@yusufceng1z/ding-react";
import { useCallback, useState, type DragEvent } from "react";

import { importConfigFile, importConfigPath, rejectMultipleFiles } from "@/lib/configImport";
import { errorMessage } from "@/lib/format";

const isInside = (element: HTMLElement, event: DragDropEvent) => {
  if (event.type === "leave") return false;
  const rect = element.getBoundingClientRect();
  const x = event.position.x / window.devicePixelRatio;
  const y = event.position.y / window.devicePixelRatio;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
};

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

export const useConfigDropZone = () => {
  const [over, setOver] = useState(false);

  const attach = useCallback((element: HTMLElement | null) => {
    if (!element || !isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onDragDropEvent(({ payload }) => {
        const inside = isInside(element, payload);
        setOver(inside && payload.type !== "drop");
        if (payload.type !== "drop" || !inside) return;
        if (payload.paths.length !== 1) { rejectMultipleFiles(); return; }
        importConfigPath(payload.paths[0]);
      })
      .then((stop) => { if (disposed) stop(); else unlisten = stop; })
      .catch((error: unknown) => toast.error(errorMessage(error)));
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const browserHandlers = isTauri() ? {} : {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(false);
      if (event.dataTransfer.files.length !== 1) { rejectMultipleFiles(); return; }
      importConfigFile(event.dataTransfer.files[0]);
    },
  };

  return { over, attach, browserHandlers };
};
