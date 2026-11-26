import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { Field } from "@/components/Field";
import { HttpHeadersField } from "@/components/HttpHeadersField";
import { LoggingNumberField } from "@/components/LoggingNumberField";
import { LoggingTextField } from "@/components/LoggingTextField";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { HttpDraft, LoggingErrors } from "@/lib/loggingSettings";
import type { HttpFormat } from "@/lib/types";

export type HttpSinkFieldsProps = {
  http: HttpDraft;
  errors: LoggingErrors;
  onChange: (changes: Partial<HttpDraft>) => void;
};

const BODY_ITEMS: { value: HttpFormat; label: string }[] = [
  { value: "ndjson", label: "NDJSON" },
  { value: "json-array", label: "JSON array" },
];

export const HttpSinkFields: FC<HttpSinkFieldsProps> = ({ http, errors, onChange }) => (
  <>
    <LoggingTextField
      label="URL"
      className="col-span-full"
      placeholder="https://logs.example.com/ingest"
      value={http.url}
      error={errors.url}
      onValueChange={(url) => onChange({ url })}
    />
    <Field label="Body format">
      <SegmentedControl
        fill
        ariaLabel="Body format"
        items={BODY_ITEMS}
        value={http.format}
        onValueChange={(format) => onChange({ format })}
      />
    </Field>
    <HttpHeadersField
      headers={http.headers}
      error={errors.headers}
      onHeadersChange={(headers) => onChange({ headers })}
    />
    <AdvancedSection>
      <LoggingNumberField
        label="Batch size"
        value={http.batchSize}
        error={errors.batchSize}
        onValueChange={(batchSize) => onChange({ batchSize })}
      />
      <LoggingNumberField
        label="Flush interval"
        suffix="s"
        value={http.flushIntervalSeconds}
        error={errors.flushInterval}
        onValueChange={(flushIntervalSeconds) => onChange({ flushIntervalSeconds })}
      />
      <LoggingNumberField
        label="Timeout"
        suffix="s"
        value={http.timeoutSeconds}
        error={errors.timeout}
        onValueChange={(timeoutSeconds) => onChange({ timeoutSeconds })}
      />
    </AdvancedSection>
  </>
);
