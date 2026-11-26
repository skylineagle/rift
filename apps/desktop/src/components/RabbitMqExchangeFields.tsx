import type { FC } from "react";

import { Field } from "@/components/Field";
import { NumberField } from "@/components/NumberField";
import { OnOffField } from "@/components/OnOffField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import type { ExchangeKind, RabbitMqEndpoint } from "@/lib/types";

export type RabbitMqExchangeFieldsProps = {
  endpoint: RabbitMqEndpoint;
  onChange: (endpoint: RabbitMqEndpoint) => void;
};

const EXCHANGE_OPTIONS: { value: ExchangeKind; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "fanout", label: "Fanout" },
  { value: "topic", label: "Topic" },
  { value: "headers", label: "Headers" },
];

export const RabbitMqExchangeFields: FC<RabbitMqExchangeFieldsProps> = ({
  endpoint,
  onChange,
}) => (
  <>
    <Field label="Exchange type">
      <SelectField
        ariaLabel="Exchange type"
        value={endpoint.exchange_type}
        options={EXCHANGE_OPTIONS}
        onValueChange={(type) => onChange({ ...endpoint, exchange_type: type as ExchangeKind })}
      />
    </Field>
    <OnOffField
      label="Create exchange"
      value={endpoint.declare_exchange}
      onValueChange={(declare_exchange) => onChange({ ...endpoint, declare_exchange })}
    />
    <OnOffField
      label="Persistent messages"
      value={endpoint.persistent}
      onValueChange={(persistent) => onChange({ ...endpoint, persistent })}
    />
    <TextField
      label="Content type"
      value={endpoint.content_type ?? ""}
      placeholder="none"
      onValueChange={(content_type) => onChange({ ...endpoint, content_type: content_type || null })}
    />
    <OnOffField
      label="Durable"
      value={endpoint.durable}
      onValueChange={(durable) => onChange({ ...endpoint, durable })}
    />
    <NumberField
      label="Reconnect delay (ms)"
      value={endpoint.reconnect_delay_ms}
      onValueChange={(value) => onChange({ ...endpoint, reconnect_delay_ms: value ?? 1000 })}
    />
  </>
);
