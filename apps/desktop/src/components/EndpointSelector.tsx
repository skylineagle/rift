import { Monitor, Server } from "lucide-react";
import { useState, type FC } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";
import { kindFor, protocolHasRoles, protocolOf, roleOf, type Protocol, type Role } from "@/lib/endpointKinds";
import type { EndpointKind, SideName } from "@/lib/types";
import { changeEndpointKind } from "@/stores/profilesStore";

export type EndpointSelectorProps = {
  profileName: string;
  side: SideName;
  kind: EndpointKind;
};

const PROTOCOL_ITEMS: { value: Protocol; label: string; tip?: string }[] = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
  { value: "ws", label: "WS", tip: "WebSocket" },
  { value: "rabbitmq", label: "AMQP", tip: "RabbitMQ" },
  { value: "uart", label: "Serial" },
];

const ROLE_ITEMS = [
  {
    value: "client" as const,
    label: (
      <span className="flex items-center gap-1.5">
        <Monitor aria-hidden="true" className="size-3.5" />
        Client
      </span>
    ),
  },
  {
    value: "server" as const,
    label: (
      <span className="flex items-center gap-1.5">
        <Server aria-hidden="true" className="size-3.5" />
        Server
      </span>
    ),
  },
];

export const EndpointSelector: FC<EndpointSelectorProps> = ({ profileName, side, kind }) => {
  const [rememberedRole, setRememberedRole] = useState<Role>("client");
  const protocol = protocolOf(kind);
  const role = roleOf(kind) ?? rememberedRole;
  const selectProtocol = (next: Protocol) => {
    setRememberedRole(role);
    changeEndpointKind(profileName, side, kindFor(next, role));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl<Protocol>
        ariaLabel={`Side ${side} protocol`}
        value={protocol}
        items={PROTOCOL_ITEMS}
        onValueChange={selectProtocol}
      />
      {protocolHasRoles(protocol) && (
        <SegmentedControl<Role>
          ariaLabel={`Side ${side} role`}
          value={role}
          items={ROLE_ITEMS}
          onValueChange={(next) => {
            setRememberedRole(next);
            changeEndpointKind(profileName, side, kindFor(protocol, next));
          }}
        />
      )}
    </div>
  );
};
