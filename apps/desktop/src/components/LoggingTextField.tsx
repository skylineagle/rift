import type { FC } from "react";

import { Field } from "@/components/Field";
import { LoggingFieldMessage } from "@/components/LoggingFieldMessage";
import { Input } from "@/components/ui/input";

export type LoggingTextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  className?: string;
  onValueChange: (value: string) => void;
};

export const LoggingTextField: FC<LoggingTextFieldProps> = ({
  label,
  value,
  placeholder,
  error,
  className,
  onValueChange,
}) => (
  <Field label={label} className={className}>
    <Input
      aria-label={label}
      aria-invalid={error !== undefined}
      className="font-mono"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      onChange={(event) => onValueChange(event.target.value)}
    />
    <LoggingFieldMessage error={error} />
  </Field>
);
