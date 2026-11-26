import type { FC } from "react";

import { Field } from "@/components/Field";
import { NumberField } from "@/components/NumberField";
import { OnOffField } from "@/components/OnOffField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import type { QueueKind, RabbitMqEndpoint } from "@/lib/types";

export type RabbitMqQueueFieldsProps = {
  endpoint: RabbitMqEndpoint;
  onChange: (endpoint: RabbitMqEndpoint) => void;
};

const QUEUE_OPTIONS: { value: QueueKind; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "quorum", label: "Quorum" },
  { value: "stream", label: "Stream" },
];

type OptionalNumberKey =
  | "message_ttl_ms"
  | "expires_ms"
  | "max_length"
  | "max_length_bytes"
  | "max_priority";

const LIMIT_FIELDS: { key: OptionalNumberKey; label: string }[] = [
  { key: "message_ttl_ms", label: "Message TTL (ms)" },
  { key: "expires_ms", label: "Queue expiry (ms)" },
  { key: "max_length", label: "Max messages" },
  { key: "max_length_bytes", label: "Max bytes" },
  { key: "max_priority", label: "Max priority" },
];

export const RabbitMqQueueFields: FC<RabbitMqQueueFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <OnOffField
      label="Create queue"
      value={endpoint.declare_queue}
      onValueChange={(declare_queue) => onChange({ ...endpoint, declare_queue })}
    />
    <Field label="Queue type">
      <SelectField
        ariaLabel="Queue type"
        value={endpoint.queue_type}
        options={QUEUE_OPTIONS}
        onValueChange={(type) => onChange({ ...endpoint, queue_type: type as QueueKind })}
      />
    </Field>
    <OnOffField
      label="Exclusive"
      value={endpoint.exclusive}
      onValueChange={(exclusive) => onChange({ ...endpoint, exclusive })}
    />
    <OnOffField
      label="Auto delete"
      value={endpoint.auto_delete}
      onValueChange={(auto_delete) => onChange({ ...endpoint, auto_delete })}
    />
    <TextField
      label="Binding key"
      value={endpoint.binding_key ?? ""}
      placeholder="routing key"
      onValueChange={(binding_key) => onChange({ ...endpoint, binding_key: binding_key || null })}
    />
    <NumberField
      label="Prefetch"
      value={endpoint.prefetch}
      onValueChange={(prefetch) => onChange({ ...endpoint, prefetch: prefetch ?? 50 })}
    />
    {LIMIT_FIELDS.map(({ key, label }) => (
      <NumberField
        key={key}
        label={label}
        value={endpoint[key]}
        placeholder="none"
        onValueChange={(value) => onChange({ ...endpoint, [key]: value })}
      />
    ))}
    <TextField
      label="Dead letter exchange"
      value={endpoint.dead_letter_exchange ?? ""}
      placeholder="none"
      onValueChange={(exchange) => onChange({ ...endpoint, dead_letter_exchange: exchange || null })}
    />
    <TextField
      label="Dead letter key"
      value={endpoint.dead_letter_routing_key ?? ""}
      placeholder="none"
      onValueChange={(key) => onChange({ ...endpoint, dead_letter_routing_key: key || null })}
    />
  </>
);
