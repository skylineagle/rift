import { Check, RefreshCw } from "lucide-react";
import { useState, type FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import { FORMAT_LABELS, TARGET_LABELS, fileName } from "@/lib/injection";
import type { InjectHistoryEntry } from "@/stores/injectHistoryStore";
import { cn } from "@/lib/utils";

export type InjectHistoryRowProps = {
  entry: InjectHistoryEntry;
  fresh: boolean;
  onLoad: (entry: InjectHistoryEntry) => void;
  onResend: (entry: InjectHistoryEntry) => Promise<boolean>;
};

const CONFIRM_MS = 900;

export const InjectHistoryRow: FC<InjectHistoryRowProps> = ({
  entry,
  fresh,
  onLoad,
  onResend,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  const resend = async () => {
    if (!(await onResend(entry))) return;
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), CONFIRM_MS);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-[7px] hover:bg-surface-3",
        fresh && "animate-history-in",
      )}
    >
      <button
        type="button"
        onClick={() => onLoad(entry)}
        className="flex min-w-0 flex-1 items-center gap-2 bg-transparent p-[6px_7px] text-left text-xs text-fg"
      >
        <span
          className={cn(
            "flex-none rounded-[4px] px-[5px] py-[3px] font-mono text-[10px] leading-none font-bold",
            entry.target === "Both" && "bg-accent-soft text-accent-text",
            entry.target === "A" && "text-ab",
            entry.target === "B" && "text-ba",
          )}
        >
          {TARGET_LABELS[entry.target]}
        </span>
        <span className="w-7 flex-none text-[9.5px] font-[650] tracking-[0.05em] text-fg-3">
          {FORMAT_LABELS[entry.format]}
        </span>
        <span className="truncate font-mono text-[11.5px] text-fg-2">
          {entry.format === "file" ? fileName(entry.value) : entry.value}
        </span>
      </button>
      <TooltipButton
        variant="ghost"
        size="icon"
        tip="Send again"
        className={cn(confirmed && "text-ok")}
        onClick={resend}
      >
        {confirmed ? <Check /> : <RefreshCw />}
      </TooltipButton>
    </div>
  );
};
