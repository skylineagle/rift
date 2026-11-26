import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { FC } from "react";

import { SendStepFields } from "@/components/SendStepFields";
import { WaitStepFields } from "@/components/WaitStepFields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KeyedStep } from "@/lib/workflows";

export type WorkflowStepCardProps = {
  step: KeyedStep;
  index: number;
  count: number;
  active: boolean;
  locked: boolean;
  onChange: (step: KeyedStep) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
};

export const WorkflowStepCard: FC<WorkflowStepCardProps> = ({
  step,
  index,
  count,
  active,
  locked,
  onChange,
  onMove,
  onRemove,
}) => {
  const position = index + 1;

  return (
    <li className="group grid grid-cols-[16px_minmax(0,1fr)] gap-2">
      <span
        className={cn(
          "pt-2 text-right font-mono text-[11px] text-fg-3",
          active && "font-bold text-accent-text",
        )}
      >
        {position}
      </span>
      <div
        aria-current={active ? "step" : undefined}
        className={cn(
          "flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-surface p-2 transition-[border-color,box-shadow] duration-150",
          active && "border-accent-line ring-[3px] ring-accent-soft",
          locked && !active && "opacity-60",
        )}
      >
        <div className="flex h-5 items-center">
          <span className="flex-1 text-[11.5px] font-semibold text-fg-2">
            {step.action === "send" ? "Send" : "Wait"}
          </span>
          <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label={`Move step ${position} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp className="size-3!" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label={`Move step ${position} down`}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown className="size-3!" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5 hover:text-err"
              aria-label={`Delete step ${position}`}
              onClick={onRemove}
            >
              <X className="size-3!" />
            </Button>
          </div>
        </div>
        {step.action === "send" ? (
          <SendStepFields step={step} onChange={(next) => onChange({ ...next, id: step.id })} />
        ) : (
          <WaitStepFields step={step} onChange={(next) => onChange({ ...next, id: step.id })} />
        )}
      </div>
    </li>
  );
};
