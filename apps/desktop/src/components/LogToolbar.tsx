import { ArrowLeft, ArrowLeftRight, ArrowRight, Pause, Play, Search } from "lucide-react";
import type { FC } from "react";

import { LogMenu, type LogMenuProps } from "@/components/LogMenu";
import type { PayloadView } from "@/components/PayloadText";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TooltipButton } from "@/components/TooltipButton";
import { formatInteger } from "@/lib/format";
import type { LogFilter } from "@/lib/logRows";

export type LogToolbarProps = LogMenuProps & {
  filter: LogFilter;
  onDirectionChange: (direction: LogFilter["direction"]) => void;
  onQueryChange: (query: string) => void;
  view: PayloadView;
  onViewChange: (view: PayloadView) => void;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  totalEvents: number;
};

const DIRECTION_ITEMS = [
  { value: "all" as const, label: <ArrowLeftRight className="size-[13px]" />, tip: "All data" },
  { value: "A" as const, label: "A", tip: "Received at A only" },
  { value: "B" as const, label: "B", tip: "Received at B only" },
  { value: "AB" as const, label: <ArrowRight className="size-[13px]" />, tip: "A → B only" },
  { value: "BA" as const, label: <ArrowLeft className="size-[13px]" />, tip: "B → A only" },
];

const VIEW_ITEMS = [
  { value: "ascii" as const, label: "Aa", tip: "Text view" },
  { value: "hex" as const, label: "0x", tip: "Hex view" },
];

export const LogToolbar: FC<LogToolbarProps> = ({
  filter,
  onDirectionChange,
  onQueryChange,
  view,
  onViewChange,
  paused,
  onPausedChange,
  totalEvents,
  ...menuProps
}) => (
  <div className="flex flex-none items-center gap-1.5 px-3 py-[7px]">
    <SegmentedControl
      ariaLabel="Direction"
      items={DIRECTION_ITEMS}
      value={filter.direction}
      onValueChange={onDirectionChange}
    />
    <label className="flex h-[26px] min-w-[110px] flex-[0_1_200px] items-center gap-1.5 rounded-[7px] border border-line-2 bg-surface px-2 text-fg-3 transition-[border-color,box-shadow] duration-100 focus-within:border-accent-line focus-within:ring-[3px] focus-within:ring-accent-soft">
      <Search className="size-[13px]" />
      <input
        aria-label="Filter log"
        placeholder="Filter"
        value={filter.query}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onQueryChange(event.target.value)}
        className="w-full min-w-0 border-0 bg-transparent text-xs text-fg outline-none"
      />
    </label>
    <span className="flex-1" />
    <span className="mr-1 text-[11.5px] whitespace-nowrap tabular-nums text-fg-3">
      {formatInteger(totalEvents)}
    </span>
    <SegmentedControl
      ariaLabel="Payload view"
      items={VIEW_ITEMS}
      value={view}
      onValueChange={onViewChange}
    />
    <TooltipButton
      variant="ghost"
      size="icon"
      aria-pressed={paused}
      tip={paused ? "Resume stream" : "Pause stream"}
      onClick={() => onPausedChange(!paused)}
    >
      {paused ? <Play /> : <Pause />}
    </TooltipButton>
    <LogMenu {...menuProps} />
  </div>
);
