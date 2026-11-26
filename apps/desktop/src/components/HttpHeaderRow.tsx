import { X } from "lucide-react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HeaderRow } from "@/lib/loggingSettings";

export type HttpHeaderRowProps = {
  header: HeaderRow;
  onHeaderChange: (header: HeaderRow) => void;
  onRemove: () => void;
};

export const HttpHeaderRow: FC<HttpHeaderRowProps> = ({ header, onHeaderChange, onRemove }) => (
  <div className="flex gap-1.5">
    <Input
      aria-label="Header name"
      placeholder="Name"
      className="font-mono"
      value={header.name}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      onChange={(event) => onHeaderChange({ ...header, name: event.target.value })}
    />
    <Input
      aria-label="Header value"
      placeholder="Value"
      type="password"
      className="font-mono"
      value={header.value}
      autoComplete="off"
      onChange={(event) => onHeaderChange({ ...header, value: event.target.value })}
    />
    <Button type="button" variant="ghost" size="icon" aria-label="Remove header" onClick={onRemove}>
      <X />
    </Button>
  </div>
);
