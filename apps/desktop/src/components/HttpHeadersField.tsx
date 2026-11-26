import { Plus } from "lucide-react";
import type { FC } from "react";

import { Field } from "@/components/Field";
import { HttpHeaderRow } from "@/components/HttpHeaderRow";
import { LoggingFieldMessage } from "@/components/LoggingFieldMessage";
import { Button } from "@/components/ui/button";
import type { HeaderRow } from "@/lib/loggingSettings";

export type HttpHeadersFieldProps = {
  headers: HeaderRow[];
  error?: string;
  onHeadersChange: (headers: HeaderRow[]) => void;
};

export const HttpHeadersField: FC<HttpHeadersFieldProps> = ({ headers, error, onHeadersChange }) => {
  const add = () => {
    const id = Math.max(-1, ...headers.map((row) => row.id)) + 1;
    onHeadersChange([...headers, { id, name: "", value: "" }]);
  };

  return (
    <Field label="Headers" className="col-span-full">
      {headers.map((header) => (
        <HttpHeaderRow
          key={header.id}
          header={header}
          onHeaderChange={(next) =>
            onHeadersChange(headers.map((row) => (row.id === next.id ? next : row)))
          }
          onRemove={() => onHeadersChange(headers.filter((row) => row.id !== header.id))}
        />
      ))}
      <Button type="button" variant="ghost" size="sm" className="-ml-2 self-start" onClick={add}>
        <Plus />
        Add header
      </Button>
      <LoggingFieldMessage error={error} />
    </Field>
  );
};
