import type { FC } from "react";

import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import {
  DURATION_UNIT_OPTIONS,
  changeUnit,
  type Duration,
  type DurationUnit,
} from "@/lib/workflows";

export type DurationFieldsProps = {
  label: string;
  duration: Duration;
  onChange: (duration: Duration) => void;
};

export const DurationFields: FC<DurationFieldsProps> = ({ label, duration, onChange }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_68px] items-end gap-1.5">
    <NumberField
      label={label}
      value={duration.amount}
      onValueChange={(amount) => onChange({ amount, unit: duration.unit })}
    />
    <SelectField
      ariaLabel={`${label} unit`}
      value={duration.unit}
      options={DURATION_UNIT_OPTIONS}
      onValueChange={(unit) => onChange(changeUnit(duration, unit as DurationUnit))}
    />
  </div>
);
