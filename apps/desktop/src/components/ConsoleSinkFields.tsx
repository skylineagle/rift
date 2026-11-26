import type { FC } from "react";

import { Field } from "@/components/Field";
import { LoggingFieldMessage } from "@/components/LoggingFieldMessage";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { ConsoleFormat } from "@/lib/types";

export type ConsoleSinkFieldsProps = {
  format: ConsoleFormat;
  onFormatChange: (format: ConsoleFormat) => void;
};

const FORMAT_ITEMS: { value: ConsoleFormat; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "json", label: "JSON" },
];

export const ConsoleSinkFields: FC<ConsoleSinkFieldsProps> = ({ format, onFormatChange }) => (
  <Field label="Format">
    <SegmentedControl
      fill
      ariaLabel="Console format"
      items={FORMAT_ITEMS}
      value={format}
      onValueChange={onFormatChange}
    />
    <LoggingFieldMessage hint="Written to stderr" />
  </Field>
);
