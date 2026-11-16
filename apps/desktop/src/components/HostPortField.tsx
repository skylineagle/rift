import type { FC } from "react";

import { Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { isValidPort, joinHostPort, parseHostPort } from "@/lib/hostPort";

export type HostPortFieldProps = {
  hostLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  optional?: boolean;
};

export const HostPortField: FC<HostPortFieldProps> = ({
  hostLabel,
  value,
  onValueChange,
  optional = false,
}) => {
  const { host, port } = parseHostPort(value);
  const blank = optional && !host && !port;
  const portInvalid = !blank && !isValidPort(port);

  const change = (next: { host: string; port: string }) =>
    onValueChange(optional && !next.host && !next.port ? "" : joinHostPort(next));

  return (
    <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_84px] gap-x-2.5">
      <Field label={hostLabel}>
        <Input
          aria-label={hostLabel}
          className="font-mono"
          value={host}
          placeholder={optional ? "auto" : "host"}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => change({ host: event.target.value, port })}
        />
      </Field>
      <Field label="Port">
        <Input
          aria-label={`${hostLabel} port`}
          aria-invalid={portInvalid}
          type="number"
          min={1}
          max={65535}
          className="font-mono"
          value={port}
          placeholder="port"
          onChange={(event) => change({ host, port: event.target.value })}
        />
      </Field>
    </div>
  );
};
