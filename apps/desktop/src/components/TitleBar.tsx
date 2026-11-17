import type { FC } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { UpdatePill } from "@/components/UpdatePill";

export const TitleBar: FC = () => (
  <div
    data-tauri-drag-region
    className="flex h-9 flex-none items-center gap-3 border-b border-line bg-surface-2 pr-2.5 pl-[78px]"
  >
    <span
      data-tauri-drag-region
      className="pointer-events-none flex items-center gap-[7px] text-[13px] font-semibold"
    >
      <img src="/icon.svg" alt="" className="size-4 rounded-[4px]" />
      Rift
    </span>
    <span data-tauri-drag-region className="flex-1 self-stretch" />
    <UpdatePill />
    <ThemeToggle />
  </div>
);
