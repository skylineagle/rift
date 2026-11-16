import { History } from "lucide-react";
import type { FC } from "react";

import { InjectHistoryRow } from "@/components/InjectHistoryRow";
import { TooltipButton } from "@/components/TooltipButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { InjectHistoryEntry } from "@/stores/injectHistoryStore";

export type InjectHistoryProps = {
  entries: InjectHistoryEntry[];
  onLoad: (entry: InjectHistoryEntry) => void;
  onResend: (entry: InjectHistoryEntry) => Promise<boolean>;
};

export const InjectHistory: FC<InjectHistoryProps> = ({ entries, onLoad, onResend }) => (
  <Popover>
    <PopoverTrigger asChild>
      <TooltipButton variant="ghost" size="icon" tip="Recent injections">
        <History />
      </TooltipButton>
    </PopoverTrigger>
    <PopoverContent align="end" side="top" sideOffset={8} className="w-[400px]">
      <div className="flex max-h-[260px] flex-col gap-px overflow-auto">
        {entries.length === 0 && (
          <div className="p-2 text-xs text-fg-3">Nothing sent yet</div>
        )}
        {entries.map((entry, index) => (
          <InjectHistoryRow
            key={`${entry.target}-${entry.format}-${entry.value}`}
            entry={entry}
            fresh={index === 0}
            onLoad={onLoad}
            onResend={onResend}
          />
        ))}
      </div>
    </PopoverContent>
  </Popover>
);
