import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import type { FC } from "react";

import { PayloadText, type PayloadView } from "@/components/PayloadText";
import { formatTime } from "@/lib/format";
import { dropText, type DataRow as DataRowModel } from "@/lib/logRows";
import { cn } from "@/lib/utils";

export type DataRowProps = {
  row: DataRowModel;
  view: PayloadView;
  open: boolean;
  fresh: boolean;
  onToggle: (id: number) => void;
};

const FRESH_WINDOW_MS = 1400;

export const DataRow: FC<DataRowProps> = ({ row, view, open, fresh, onToggle }) => {
  const received = row.origin === "received";
  const injected = row.origin === "injected";
  const dropped = !row.delivered;
  const Arrow = row.direction === "AB" ? ArrowRight : ArrowLeft;
  const sideA = injected
    ? row.direction === "BA"
    : row.direction === "A" || row.direction === "AB";
  const identityTint = sideA ? "text-ab" : "text-ba";

  return (
    <div
      onClick={() => onToggle(row.id)}
      className={cn(
        "grid h-[22px] cursor-pointer grid-cols-[90px_16px_46px_minmax(0,1fr)] items-center gap-x-3 px-3.5 whitespace-nowrap shadow-[inset_2px_0_0_transparent] hover:bg-surface-2",
        injected && "shadow-[inset_2px_0_0_var(--accent)]",
        open && "bg-surface-3 hover:bg-surface-3",
        injected && fresh && Date.now() - row.time < FRESH_WINDOW_MS && "animate-fresh",
      )}
    >
      <span
        className={cn(
          "overflow-hidden text-ellipsis",
          dropped ? "text-fg-3" : cn(identityTint, "opacity-75"),
        )}
      >
        {formatTime(row.time)}
      </span>
      <span
        title={received ? `Received at ${row.direction}` : row.direction === "AB" ? "A → B" : "B → A"}
        className={cn("grid place-items-center", dropped ? "text-fg-3" : identityTint)}
      >
        {received ? row.direction : dropped ? <AlertTriangle className="size-3" /> : <Arrow className="size-3" />}
      </span>
      <span
        className={cn(
          "overflow-hidden text-right text-ellipsis text-fg-3",
          dropped && "line-through",
        )}
      >
        {row.bytes.length} B
      </span>
      <span className={cn("overflow-hidden text-ellipsis", dropped && "text-fg-3")}>
        {dropped ? dropText(row) : <PayloadText bytes={row.bytes} view={view} />}
      </span>
    </div>
  );
};
