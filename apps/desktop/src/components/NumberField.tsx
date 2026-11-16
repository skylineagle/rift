import type { FC } from "react";

import { Field } from "@/components/Field";
import { Input } from "@/components/ui/input";

export type NumberFieldProps = {
  label: string;
  value: number | null;
  placeholder?: string;
  onValueChange: (value: number | null) => void;
};

export const NumberField: FC<NumberFieldProps> = ({
  label,
  value,
  placeholder,
  onValueChange,
}) => (
  <Field label={label}>
    <Input
      aria-label={label}
      type="number"
      min={0}
      className="font-mono"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(event) =>
        onValueChange(event.target.value === "" ? null : Number(event.target.value))
      }
    />
  </Field>
);
