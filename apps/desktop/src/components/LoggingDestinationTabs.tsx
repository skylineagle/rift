import type { FC } from "react";

import { ConsoleSinkFields } from "@/components/ConsoleSinkFields";
import { FileSinkFields } from "@/components/FileSinkFields";
import { HttpSinkFields } from "@/components/HttpSinkFields";
import { LoggingSinkPanel } from "@/components/LoggingSinkPanel";
import { LoggingTabTrigger } from "@/components/LoggingTabTrigger";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { hasDestinationError, type LoggingDraft, type LoggingErrors } from "@/lib/loggingSettings";

export type LoggingDestinationTabsProps = {
  draft: LoggingDraft;
  errors: LoggingErrors;
  defaultDirectory: string;
  onChange: (changes: Partial<LoggingDraft>) => void;
};

export const LoggingDestinationTabs: FC<LoggingDestinationTabsProps> = ({
  draft,
  errors,
  defaultDirectory,
  onChange,
}) => {
  const { console, file, http } = draft;

  return (
    <Tabs defaultValue="console" className="border-t border-line px-4 pt-3.5 pb-4">
      <TabsList aria-label="Destinations">
        <LoggingTabTrigger value="console" label="Console" enabled={console.enabled} invalid={hasDestinationError(errors, "console")} />
        <LoggingTabTrigger value="file" label="File" enabled={file.enabled} invalid={hasDestinationError(errors, "file")} />
        <LoggingTabTrigger value="http" label="HTTP" enabled={http.enabled} invalid={hasDestinationError(errors, "http")} />
      </TabsList>
      <div className="mt-3 grid">
        <LoggingSinkPanel
          value="console"
          label="Write to console"
          enabled={console.enabled}
          onEnabledChange={(enabled) => onChange({ console: { ...console, enabled } })}
        >
          <ConsoleSinkFields
            format={console.format}
            onFormatChange={(format) => onChange({ console: { ...console, format } })}
          />
        </LoggingSinkPanel>
        <LoggingSinkPanel
          value="file"
          label="Write to files"
          enabled={file.enabled}
          onEnabledChange={(enabled) => onChange({ file: { ...file, enabled } })}
        >
          <FileSinkFields
            file={file}
            errors={errors}
            defaultDirectory={defaultDirectory}
            onChange={(changes) => onChange({ file: { ...file, ...changes } })}
          />
        </LoggingSinkPanel>
        <LoggingSinkPanel
          value="http"
          label="Send over HTTP"
          enabled={http.enabled}
          onEnabledChange={(enabled) => onChange({ http: { ...http, enabled } })}
        >
          <HttpSinkFields
            http={http}
            errors={errors}
            onChange={(changes) => onChange({ http: { ...http, ...changes } })}
          />
        </LoggingSinkPanel>
      </div>
    </Tabs>
  );
};
