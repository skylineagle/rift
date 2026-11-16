import { ChevronDown } from "lucide-react";
import { useState, type FC } from "react";

import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BaudRateFieldProps = {
  value: number;
  onValueChange: (value: number) => void;
};

const COMMON_BAUD_RATES = [
  1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
];

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;

export const BaudRateField: FC<BaudRateFieldProps> = ({ value, onValueChange }) => {
  const [draft, setDraft] = useState(String(value));
  const [open, setOpen] = useState(false);
  const invalid = !isPositiveInteger(Number(draft)) || draft.trim() === "";

  const edit = (text: string) => {
    setDraft(text);
    const parsed = Number(text);
    if (text.trim() !== "" && isPositiveInteger(parsed)) onValueChange(parsed);
  };

  const choose = (rate: number) => {
    setDraft(String(rate));
    onValueChange(rate);
    setOpen(false);
  };

  return (
    <Field label="Baud rate" className="col-span-2">
      <div className="flex gap-1.5">
        <Input
          aria-label="Baud rate"
          aria-invalid={invalid}
          type="number"
          min={1}
          step={1}
          className="font-mono"
          value={draft}
          onChange={(event) => edit(event.target.value)}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Common baud rates">
              <ChevronDown />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-36 p-1">
            {COMMON_BAUD_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => choose(rate)}
                className={cn(
                  "flex h-6 w-full items-center rounded-[5px] px-2 font-mono text-xs text-fg-2 hover:bg-surface-3 hover:text-fg",
                  rate === value && "bg-surface-3 text-fg",
                )}
              >
                {formatInteger(rate)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </Field>
  );
};
