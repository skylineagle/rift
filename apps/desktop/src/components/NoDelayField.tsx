import type { FC } from "react";

import { Field } from "@/components/Field";
import { SegmentedControl } from "@/components/SegmentedControl";

export type NoDelayFieldProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

const ITEMS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

export const NoDelayField: FC<NoDelayFieldProps> = ({ value, onValueChange }) => (
  <Field label="TCP no delay">
    <SegmentedControl
      fill
      ariaLabel="TCP no delay"
      items={ITEMS}
      value={value ? "on" : "off"}
      onValueChange={(next) => onValueChange(next === "on")}
    />
  </Field>
);
