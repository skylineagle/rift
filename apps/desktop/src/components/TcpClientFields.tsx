import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { HostPortField } from "@/components/HostPortField";
import { NoDelayField } from "@/components/NoDelayField";
import { NumberField } from "@/components/NumberField";
import type { TcpClientEndpoint } from "@/lib/types";

export type TcpClientFieldsProps = {
  endpoint: TcpClientEndpoint;
  onChange: (endpoint: TcpClientEndpoint) => void;
};

export const TcpClientFields: FC<TcpClientFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <HostPortField
      hostLabel="Remote host"
      value={endpoint.address}
      onValueChange={(address) => onChange({ ...endpoint, address })}
    />
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
      <NoDelayField
        value={endpoint.no_delay}
        onValueChange={(no_delay) => onChange({ ...endpoint, no_delay })}
      />
    </AdvancedSection>
  </>
);
