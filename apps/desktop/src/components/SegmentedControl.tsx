import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SegmentItem<Value extends string> = {
  value: Value;
  label: ReactNode;
  tip?: string;
};

export type SegmentedControlProps<Value extends string> = {
  items: SegmentItem<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  fill?: boolean;
};

export const SegmentedControl = <Value extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  fill = false,
}: SegmentedControlProps<Value>) => {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const select = (next: string) => {
    const match = items.find((item) => item.value === next);
    if (match) onValueChange(match.value);
  };

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={select}
      aria-label={ariaLabel}
      style={{ "--count": items.length, "--index": activeIndex } as React.CSSProperties}
      className={cn(
        "relative isolate grid shrink-0 grid-flow-col auto-cols-fr gap-0 rounded-lg border border-line-2 bg-surface-2 p-0.5",
        fill ? "w-full" : "w-fit",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 bottom-0.5 left-0.5 -z-10 w-[calc((100%-4px)/var(--count))] translate-x-[calc(var(--index)*100%)] rounded-md bg-surface-4 shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_0_0_1px_var(--line-2)] transition-transform duration-200 ease-io motion-reduce:transition-none"
      />
      {items.map((item) => {
        const toggle = (
          <ToggleGroupItem
            value={item.value}
            aria-label={item.tip}
            className="h-[22px] min-w-[26px] rounded-md! bg-transparent! px-[7px] text-xs font-semibold text-fg-3 transition-colors duration-150 hover:bg-transparent! hover:text-fg aria-checked:text-fg aria-pressed:text-fg"
          >
            {item.label}
          </ToggleGroupItem>
        );
        return item.tip ? (
          <Tooltip key={item.value}>
            <TooltipTrigger asChild>{toggle}</TooltipTrigger>
            <TooltipContent>{item.tip}</TooltipContent>
          </Tooltip>
        ) : (
          <span key={item.value} className="contents">
            {toggle}
          </span>
        );
      })}
    </ToggleGroup>
  );
};
