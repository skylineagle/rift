import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { MessageFormatFields } from "@/components/MessageFormatFields";
import { NumberField } from "@/components/NumberField";
import { TextField } from "@/components/TextField";
import type { WebSocketClientEndpoint } from "@/lib/types";

export type WebSocketClientFieldsProps = {
  endpoint: WebSocketClientEndpoint;
  onChange: (endpoint: WebSocketClientEndpoint) => void;
};

export const WebSocketClientFields: FC<WebSocketClientFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <TextField
      wide
      label="URL"
      value={endpoint.url}
      placeholder="ws://host:port/path"
      onValueChange={(url) => onChange({ ...endpoint, url })}
    />
    <MessageFormatFields value={endpoint} onChange={(format) => onChange({ ...endpoint, ...format })} />
    <AdvancedSection>
      <NumberField
        label="Reconnect delay (ms)"
        value={endpoint.reconnect_delay_ms}
        onValueChange={(value) => onChange({ ...endpoint, reconnect_delay_ms: value ?? 1000 })}
      />
      <NumberField
        label="Connect timeout (ms)"
        value={endpoint.connect_timeout_ms}
        onValueChange={(value) => onChange({ ...endpoint, connect_timeout_ms: value ?? 5000 })}
      />
    </AdvancedSection>
  </>
);
