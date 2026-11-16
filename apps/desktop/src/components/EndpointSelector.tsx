import { Monitor, Server } from "lucide-react";
import { useState, type FC } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";
import type { EndpointKind, SideName } from "@/lib/types";
import { changeEndpointKind } from "@/stores/profilesStore";

export type EndpointSelectorProps = {
  profileName: string;
  side: SideName;
  kind: EndpointKind;
};

type Protocol = "tcp" | "udp" | "uart";
type Role = "client" | "server";

export const EndpointSelector: FC<EndpointSelectorProps> = ({ profileName, side, kind }) => {
  const [rememberedRole, setRememberedRole] = useState<Role>("client");
  const protocol: Protocol = kind === "uart" ? "uart" : kind.startsWith("tcp") ? "tcp" : "udp";
  const role: Role = kind === "uart" ? rememberedRole : kind.endsWith("server") ? "server" : "client";
  const selectProtocol = (next: Protocol) => {
    setRememberedRole(role);
    changeEndpointKind(profileName, side, next === "uart" ? "uart" : `${next}-${role}`);
  };

  return (
    <div className="flex items-center gap-2">
      <SegmentedControl<Protocol>
        ariaLabel={`Side ${side} protocol`}
        value={protocol}
        items={[{ value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }, { value: "uart", label: "Serial" }]}
        onValueChange={selectProtocol}
      />
      {protocol !== "uart" && (
        <SegmentedControl<Role>
          ariaLabel={`Side ${side} role`}
          value={role}
          items={[
            {
              value: "client",
              label: (
                <span className="flex items-center gap-1.5">
                  <Monitor aria-hidden="true" className="size-3.5" />
                  Client
                </span>
              ),
            },
            {
              value: "server",
              label: (
                <span className="flex items-center gap-1.5">
                  <Server aria-hidden="true" className="size-3.5" />
                  Server
                </span>
              ),
            },
          ]}
          onValueChange={(next) => {
            setRememberedRole(next);
            changeEndpointKind(profileName, side, `${protocol}-${next}`);
          }}
        />
      )}
    </div>
  );
};
