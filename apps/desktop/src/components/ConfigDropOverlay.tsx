import { FileUp } from "lucide-react";
import type { FC } from "react";

import { cn } from "@/lib/utils";

export type ConfigDropOverlayProps = {
  visible: boolean;
};

export const ConfigDropOverlay: FC<ConfigDropOverlayProps> = ({ visible }) => (
  <div
    aria-hidden={!visible}
    className={cn(
      "pointer-events-none absolute inset-1.5 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent-line bg-surface-2/90 text-center backdrop-blur-sm transition-all duration-150 ease-out",
      visible ? "scale-100 opacity-100" : "scale-[0.98] opacity-0",
    )}
  >
    <FileUp className={cn("size-6 text-fg-2 transition-transform duration-200", visible && "-translate-y-0.5")} />
    <span className="text-xs font-medium text-fg-2">Drop to import</span>
    <span className="text-[11px] text-fg-3">One configuration file</span>
  </div>
);
