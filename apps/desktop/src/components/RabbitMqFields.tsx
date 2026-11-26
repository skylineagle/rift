import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { RabbitMqExchangeFields } from "@/components/RabbitMqExchangeFields";
import { RabbitMqQueueFields } from "@/components/RabbitMqQueueFields";
import { TextField } from "@/components/TextField";
import type { RabbitMqEndpoint } from "@/lib/types";

export type RabbitMqFieldsProps = {
  endpoint: RabbitMqEndpoint;
  onChange: (endpoint: RabbitMqEndpoint) => void;
};

export const RabbitMqFields: FC<RabbitMqFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <TextField
      wide
      label="Broker URL"
      value={endpoint.url}
      placeholder="amqp://user:pass@host:5672/vhost"
      onValueChange={(url) => onChange({ ...endpoint, url })}
    />
    <TextField
      label="Exchange"
      value={endpoint.exchange}
      placeholder="default"
      onValueChange={(exchange) => onChange({ ...endpoint, exchange })}
    />
    <TextField
      label="Routing key"
      value={endpoint.routing_key}
      placeholder="publish key"
      onValueChange={(routing_key) => onChange({ ...endpoint, routing_key })}
    />
    <TextField
      wide
      label="Consume queue"
      value={endpoint.queue ?? ""}
      placeholder="none (publish only)"
      onValueChange={(queue) => onChange({ ...endpoint, queue: queue || null })}
    />
    <AdvancedSection>
      <RabbitMqExchangeFields endpoint={endpoint} onChange={onChange} />
      {endpoint.queue !== null && <RabbitMqQueueFields endpoint={endpoint} onChange={onChange} />}
    </AdvancedSection>
  </>
);
