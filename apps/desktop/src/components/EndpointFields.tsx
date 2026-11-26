import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { HostPortField } from "@/components/HostPortField";
import { RabbitMqFields } from "@/components/RabbitMqFields";
import { TcpClientFields } from "@/components/TcpClientFields";
import { TcpServerFields } from "@/components/TcpServerFields";
import { UartFields } from "@/components/UartFields";
import { UdpServerFields } from "@/components/UdpServerFields";
import { WebSocketClientFields } from "@/components/WebSocketClientFields";
import { WebSocketServerFields } from "@/components/WebSocketServerFields";
import type { Endpoint } from "@/lib/types";

export type EndpointFieldsProps = {
  endpoint: Endpoint;
  onChange: (endpoint: Endpoint) => void;
};

export const EndpointFields: FC<EndpointFieldsProps> = ({ endpoint, onChange }) => {
  switch (endpoint.kind) {
    case "tcp-client":
      return <TcpClientFields endpoint={endpoint} onChange={onChange} />;
    case "tcp-server":
      return <TcpServerFields endpoint={endpoint} onChange={onChange} />;
    case "udp-server":
      return <UdpServerFields endpoint={endpoint} onChange={onChange} />;
    case "udp-client":
      return (
        <>
          <HostPortField
            hostLabel="Remote host"
            value={endpoint.remote}
            onValueChange={(remote) => onChange({ ...endpoint, remote })}
          />
          <AdvancedSection>
            <HostPortField
              optional
              hostLabel="Local bind host"
              value={endpoint.bind ?? ""}
              onValueChange={(bind) => onChange({ ...endpoint, bind: bind || null })}
            />
          </AdvancedSection>
        </>
      );
    case "uart":
      return <UartFields endpoint={endpoint} onChange={onChange} />;
    case "websocket-client":
      return <WebSocketClientFields endpoint={endpoint} onChange={onChange} />;
    case "websocket-server":
      return <WebSocketServerFields endpoint={endpoint} onChange={onChange} />;
    case "rabbitmq":
      return <RabbitMqFields endpoint={endpoint} onChange={onChange} />;
  }
};
