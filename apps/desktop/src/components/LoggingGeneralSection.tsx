import type { FC } from "react";

import { Field } from "@/components/Field";
import { LoggingNumberField } from "@/components/LoggingNumberField";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { LoggingDraft, LoggingErrors } from "@/lib/loggingSettings";
import type { LogLevel } from "@/lib/types";

export type LoggingGeneralSectionProps = {
  draft: LoggingDraft;
  errors: LoggingErrors;
  onChange: (changes: Partial<LoggingDraft>) => void;
};

const LEVEL_ITEMS: { value: LogLevel; label: string }[] = [
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

export const LoggingGeneralSection: FC<LoggingGeneralSectionProps> = ({ draft, errors, onChange }) => (
  <section className="grid grid-cols-[1fr_150px] items-start gap-x-4 px-4 pb-4">
    <Field label="Level">
      <SegmentedControl
        fill
        ariaLabel="Log level"
        items={LEVEL_ITEMS}
        value={draft.level}
        onValueChange={(level) => onChange({ level })}
      />
    </Field>
    <LoggingNumberField
      label="Stats interval"
      suffix="s"
      hint="0 turns stats off"
      value={draft.statsIntervalSeconds}
      error={errors.statsInterval}
      onValueChange={(statsIntervalSeconds) => onChange({ statsIntervalSeconds })}
    />
  </section>
);
