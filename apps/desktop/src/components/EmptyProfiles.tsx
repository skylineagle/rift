import { Plus } from "lucide-react";
import type { FC } from "react";

import { createProfile } from "@/stores/profilesStore";

export const EmptyProfiles: FC = () => (
  <div className="grid place-items-center p-6">
    <div className="flex max-w-[280px] flex-col items-center gap-3.5 text-center">
      <button
        type="button"
        aria-label="Create your first bridge"
        onClick={createProfile}
        className="group grid size-16 place-items-center rounded-2xl border border-line-2 bg-surface-2 text-fg-2 transition-[background-color,border-color,color,transform] duration-200 ease-out outline-none hover:border-accent-line hover:bg-accent-soft hover:text-accent-text focus-visible:border-accent-line focus-visible:ring-[3px] focus-visible:ring-accent-soft active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Plus className="size-7 transition-transform duration-200 ease-out group-hover:rotate-90 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
      </button>
      <div className="flex flex-col gap-1">
        <b className="text-[13px] font-medium">Create your first bridge</b>
        <p className="text-xs leading-relaxed text-fg-3">
          A profile links two endpoints, like a TCP server and a serial port, and relays
          data between them.
        </p>
      </div>
    </div>
  </div>
);
