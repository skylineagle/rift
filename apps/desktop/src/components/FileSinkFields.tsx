import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { Field } from "@/components/Field";
import { LogDirectoryField } from "@/components/LogDirectoryField";
import { LoggingNumberField } from "@/components/LoggingNumberField";
import { LoggingTextField } from "@/components/LoggingTextField";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { FileDraft, LoggingErrors } from "@/lib/loggingSettings";
import type { RotationPolicy } from "@/lib/types";

export type FileSinkFieldsProps = {
  file: FileDraft;
  errors: LoggingErrors;
  defaultDirectory: string;
  onChange: (changes: Partial<FileDraft>) => void;
};

const ROTATE_ITEMS: { value: RotationPolicy; label: string }[] = [
  { value: "size", label: "Size" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
];

export const FileSinkFields: FC<FileSinkFieldsProps> = ({ file, errors, defaultDirectory, onChange }) => (
  <>
    <LogDirectoryField
      directory={file.directory}
      defaultDirectory={defaultDirectory}
      onDirectoryChange={(directory) => onChange({ directory })}
    />
    <Field label="Rotate">
      <SegmentedControl
        fill
        ariaLabel="Rotation policy"
        items={ROTATE_ITEMS}
        value={file.rotate}
        onValueChange={(rotate) => onChange({ rotate })}
      />
    </Field>
    {file.rotate === "size" ? (
      <LoggingNumberField
        label="Max file size"
        suffix="MB"
        value={file.maxFileMegabytes}
        error={errors.maxFileSize}
        onValueChange={(maxFileMegabytes) => onChange({ maxFileMegabytes })}
      />
    ) : (
      <span />
    )}
    <LoggingNumberField
      label="Keep files"
      hint="0 keeps every file"
      value={file.maxFiles}
      error={errors.maxFiles}
      onValueChange={(maxFiles) => onChange({ maxFiles })}
    />
    <LoggingNumberField
      label="Max total storage"
      suffix="MB"
      placeholder="No cap"
      value={file.maxTotalMegabytes}
      error={errors.maxTotalSize}
      onValueChange={(maxTotalMegabytes) => onChange({ maxTotalMegabytes })}
    />
    <AdvancedSection>
      <LoggingTextField
        label="File name"
        value={file.file_name}
        error={errors.fileName}
        onValueChange={(file_name) => onChange({ file_name })}
      />
    </AdvancedSection>
  </>
);
