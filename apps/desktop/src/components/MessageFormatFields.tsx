import type { FC } from "react";

import { Field } from "@/components/Field";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import type { JsonValue, MessageFormat, WireFormat } from "@/lib/types";

export type MessageFormatFieldsProps = {
  value: MessageFormat;
  onChange: (value: MessageFormat) => void;
};

const FORMAT_OPTIONS: { value: WireFormat; label: string }[] = [
  { value: "binary", label: "Binary frames" },
  { value: "text", label: "Text (UTF-8)" },
  { value: "base64", label: "Base64 text" },
  { value: "hex", label: "Hex text" },
  { value: "json", label: "JSON envelope" },
];

const JSON_VALUE_OPTIONS: { value: JsonValue; label: string }[] = [
  { value: "text", label: "Text string" },
  { value: "base64", label: "Base64 string" },
  { value: "hex", label: "Hex string" },
  { value: "json", label: "Parsed JSON" },
];

export const MessageFormatFields: FC<MessageFormatFieldsProps> = ({ value, onChange }) => (
  <>
    <Field label="Message format" className={value.format === "json" ? undefined : "col-span-2"}>
      <SelectField
        ariaLabel="Message format"
        value={value.format}
        options={FORMAT_OPTIONS}
        onValueChange={(format) => onChange({ ...value, format: format as WireFormat })}
      />
    </Field>
    {value.format === "json" && (
      <>
        <Field label="Data encoding">
          <SelectField
            ariaLabel="Data encoding"
            value={value.json_value}
            options={JSON_VALUE_OPTIONS}
            onValueChange={(json_value) =>
              onChange({ ...value, json_value: json_value as JsonValue })
            }
          />
        </Field>
        <TextField
          wide
          label="Data field (dot path)"
          value={value.json_field}
          placeholder="data"
          onValueChange={(json_field) => onChange({ ...value, json_field: json_field || "data" })}
        />
      </>
    )}
  </>
);
