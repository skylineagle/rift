import type { FC } from "react";

import { Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  wide?: boolean;
  onValueChange: (value: string) => void;
};

export const TextField: FC<TextFieldProps> = ({
  label,
  value,
  placeholder,
  wide = false,
  onValueChange,
}) => (
  <Field label={label} className={cn(wide && "col-span-2")}>
    <Input
      aria-label={label}
      className="font-mono"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      onChange={(event) => onValueChange(event.target.value)}
    />
  </Field>
);
