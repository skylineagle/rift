import type { FC } from "react";

import { Field } from "@/components/Field";
import { NumberField } from "@/components/NumberField";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { RepeatMode, Repetition } from "@/lib/workflows";

export type RepeatFieldsProps = {
  repetition: Repetition;
  onChange: (repetition: Repetition) => void;
};

const MODE_ITEMS: { value: RepeatMode; label: string }[] = [
  { value: "forever", label: "Forever" },
  { value: "count", label: "Count" },
];

export const RepeatFields: FC<RepeatFieldsProps> = ({ repetition, onChange }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_68px] items-end gap-1.5">
    <Field label="Repeat">
      <SegmentedControl
        fill
        ariaLabel="Repeat"
        items={MODE_ITEMS}
        value={repetition.mode}
        onValueChange={(mode) => onChange({ ...repetition, mode })}
      />
    </Field>
    {repetition.mode === "count" && (
      <NumberField
        label="Times"
        value={repetition.count}
        onValueChange={(count) => onChange({ ...repetition, count })}
      />
    )}
  </div>
);
