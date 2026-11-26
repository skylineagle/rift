import type { FC } from "react";

import { Field } from "@/components/Field";
import { LoggingFieldMessage } from "@/components/LoggingFieldMessage";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type LoggingNumberFieldProps = {
  label: string;
  value: number | null;
  suffix?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  onValueChange: (value: number | null) => void;
};

export const LoggingNumberField: FC<LoggingNumberFieldProps> = ({
  label,
  value,
  suffix,
  placeholder,
  hint,
  error,
  onValueChange,
}) => (
  <Field label={label}>
    <div className="relative">
      <Input
        aria-label={label}
        aria-invalid={error !== undefined}
        type="number"
        min={0}
        className={cn("font-mono", suffix && "pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) =>
          onValueChange(event.target.value === "" ? null : Number(event.target.value))
        }
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-[9px] flex items-center text-[11px] text-fg-3">
          {suffix}
        </span>
      )}
    </div>
    <LoggingFieldMessage hint={hint} error={error} />
  </Field>
);
