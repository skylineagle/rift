import type { FC } from "react";

import { formatTime } from "@/lib/format";
import type { StatusRow as StatusRowModel } from "@/lib/logRows";
import { cn } from "@/lib/utils";

export type StatusRowProps = { row: StatusRowModel };

export const StatusRow: FC<StatusRowProps> = ({ row }) => (
  <div className="grid h-[22px] grid-cols-[90px_16px_46px_minmax(0,1fr)] items-center gap-x-3 px-3.5 whitespace-nowrap">
    <span className="overflow-hidden text-ellipsis text-fg-3">{formatTime(row.time)}</span>
    <span className="grid place-items-center">
      <b
        className={cn(
          "rounded-[4px] px-1 py-0.5 font-mono text-[10px] leading-none font-bold",
          row.side === "A" && "text-ab",
          row.side === "B" && "text-ba",
          !row.side && "text-fg-3",
        )}
      >
        {row.side ?? "⇄"}
      </b>
    </span>
    <span
      className={cn(
        "col-span-2 overflow-hidden font-sans text-xs text-ellipsis text-fg-3",
        row.level === "warn" && "text-warn",
        row.level === "err" && "text-err",
      )}
    >
      {row.text}
    </span>
  </div>
);
