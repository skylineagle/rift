import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { HostPortField } from "@/components/HostPortField";
import { NoDelayField } from "@/components/NoDelayField";
import { NumberField } from "@/components/NumberField";
import type { TcpServerEndpoint } from "@/lib/types";

export type TcpServerFieldsProps = {
  endpoint: TcpServerEndpoint;
  onChange: (endpoint: TcpServerEndpoint) => void;
};

export const TcpServerFields: FC<TcpServerFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <HostPortField
      hostLabel="Bind host"
      value={endpoint.bind}
      onValueChange={(bind) => onChange({ ...endpoint, bind })}
    />
    <AdvancedSection>
      <NumberField
        label="Max clients"
        value={endpoint.max_clients}
        placeholder="unlimited"
        onValueChange={(max_clients) => onChange({ ...endpoint, max_clients })}
      />
      <NoDelayField
        value={endpoint.no_delay}
        onValueChange={(no_delay) => onChange({ ...endpoint, no_delay })}
      />
    </AdvancedSection>
  </>
);
