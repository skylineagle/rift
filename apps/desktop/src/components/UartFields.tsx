import { RefreshCw } from "lucide-react";
import type { FC } from "react";

import { AdvancedSection } from "@/components/AdvancedSection";
import { BaudRateField } from "@/components/BaudRateField";
import { Field } from "@/components/Field";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SelectField } from "@/components/SelectField";
import { TooltipButton } from "@/components/TooltipButton";
import { useStore } from "@/hooks/useStore";
import type { FlowControl, Parity, UartEndpoint } from "@/lib/types";
import { portsStore, rescanPorts } from "@/stores/portsStore";

export type UartFieldsProps = {
  endpoint: UartEndpoint;
  onChange: (endpoint: UartEndpoint) => void;
};

const PARITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "even", label: "Even" },
  { value: "odd", label: "Odd" },
];

const FLOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "hardware", label: "RTS/CTS" },
  { value: "software", label: "XON/XOFF" },
];

const DATA_BIT_ITEMS = ["5", "6", "7", "8"].map((value) => ({ value, label: value }));
const STOP_BIT_ITEMS = ["1", "2"].map((value) => ({ value, label: value }));

const shortPortName = (port: string) =>
  port.replace("/dev/tty.", "").replace("/dev/", "");

export const UartFields: FC<UartFieldsProps> = ({ endpoint, onChange }) => {
  const ports = useStore(portsStore, (state) => state);
  const portOptions = ports.map((port) => ({
    value: port.name,
    label: `${shortPortName(port.name)}${port.description ? ` · ${port.description}` : ""}`,
  }));
  if (endpoint.port && !ports.some((port) => port.name === endpoint.port)) {
    portOptions.unshift({ value: endpoint.port, label: shortPortName(endpoint.port) });
  }

  return (
    <>
      <Field label="Port" className="col-span-2">
        <div className="flex gap-1.5">
          <SelectField
            ariaLabel="Port"
            value={endpoint.port}
            options={portOptions}
            placeholder="Choose a port"
            onValueChange={(port) => onChange({ ...endpoint, port })}
          />
          <TooltipButton
            variant="secondary"
            size="icon"
            tip="Rescan ports"
            onClick={() => rescanPorts(true)}
          >
            <RefreshCw />
          </TooltipButton>
        </div>
      </Field>
      <BaudRateField
        value={endpoint.baud_rate}
        onValueChange={(baud_rate) => onChange({ ...endpoint, baud_rate })}
      />
      <AdvancedSection>
        <Field label="Data bits">
          <SegmentedControl
            fill
            ariaLabel="Data bits"
            items={DATA_BIT_ITEMS}
            value={String(endpoint.data_bits)}
            onValueChange={(bits) => onChange({ ...endpoint, data_bits: Number(bits) })}
          />
        </Field>
        <Field label="Stop bits">
          <SegmentedControl
            fill
            ariaLabel="Stop bits"
            items={STOP_BIT_ITEMS}
            value={String(endpoint.stop_bits)}
            onValueChange={(bits) => onChange({ ...endpoint, stop_bits: Number(bits) })}
          />
        </Field>
        <Field label="Parity">
          <SelectField
            ariaLabel="Parity"
            value={endpoint.parity}
            options={PARITY_OPTIONS}
            onValueChange={(parity) => onChange({ ...endpoint, parity: parity as Parity })}
          />
        </Field>
        <Field label="Flow control">
          <SelectField
            ariaLabel="Flow control"
            value={endpoint.flow_control}
            options={FLOW_OPTIONS}
            onValueChange={(flow) =>
              onChange({ ...endpoint, flow_control: flow as FlowControl })
            }
          />
        </Field>
      </AdvancedSection>
    </>
  );
};
