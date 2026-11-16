import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { Field } from "@/components/Field";
import { HostPortField } from "@/components/HostPortField";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import type { ReplyTo, UdpServerEndpoint } from "@/lib/types";

export type UdpServerFieldsProps = {
  endpoint: UdpServerEndpoint;
  onChange: (endpoint: UdpServerEndpoint) => void;
};

const REPLY_OPTIONS = [
  { value: "all", label: "All peers" },
  { value: "last", label: "Last peer" },
];

export const UdpServerFields: FC<UdpServerFieldsProps> = ({ endpoint, onChange }) => (
  <>
    <HostPortField
      hostLabel="Bind host"
      value={endpoint.bind}
      onValueChange={(bind) => onChange({ ...endpoint, bind })}
    />
    <AdvancedSection>
      <Field label="Reply to">
        <SelectField
          ariaLabel="Reply to"
          value={endpoint.reply_to}
          options={REPLY_OPTIONS}
          onValueChange={(reply) => onChange({ ...endpoint, reply_to: reply as ReplyTo })}
        />
      </Field>
      <NumberField
        label="Peer timeout (s)"
        value={endpoint.peer_timeout_secs}
        placeholder="never"
        onValueChange={(peer_timeout_secs) => onChange({ ...endpoint, peer_timeout_secs })}
      />
    </AdvancedSection>
  </>
);
