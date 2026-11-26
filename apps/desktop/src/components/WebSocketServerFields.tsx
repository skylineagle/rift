import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { HostPortField } from "@/components/HostPortField";
import { MessageFormatFields } from "@/components/MessageFormatFields";
import { NumberField } from "@/components/NumberField";
import { TextField } from "@/components/TextField";
import type { WebSocketServerEndpoint } from "@/lib/types";

export type WebSocketServerFieldsProps = {
  endpoint: WebSocketServerEndpoint;
  onChange: (endpoint: WebSocketServerEndpoint) => void;
};

const normalizePath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

export const WebSocketServerFields: FC<WebSocketServerFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <HostPortField
      hostLabel="Bind host"
      value={endpoint.bind}
      onValueChange={(bind) => onChange({ ...endpoint, bind })}
    />
    <MessageFormatFields value={endpoint} onChange={(format) => onChange({ ...endpoint, ...format })} />
    <AdvancedSection>
      <TextField
        label="Path"
        value={endpoint.path ?? ""}
        placeholder="any"
        onValueChange={(path) => onChange({ ...endpoint, path: normalizePath(path) })}
      />
      <NumberField
        label="Max clients"
        value={endpoint.max_clients}
        placeholder="unlimited"
        onValueChange={(max_clients) => onChange({ ...endpoint, max_clients })}
      />
    </AdvancedSection>
  </>
);
