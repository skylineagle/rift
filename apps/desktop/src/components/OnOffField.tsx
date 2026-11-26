import type { FC } from "react";

import { Field } from "@/components/Field";
import { SegmentedControl } from "@/components/SegmentedControl";

export type OnOffFieldProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

const ITEMS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

export const OnOffField: FC<OnOffFieldProps> = ({ label, value, onValueChange }) => (
  <Field label={label}>
    <SegmentedControl
      fill
      ariaLabel={label}
      items={ITEMS}
      value={value ? "on" : "off"}
      onValueChange={(next) => onValueChange(next === "on")}
    />
  </Field>
);
