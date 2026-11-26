import type { FC } from "react";

import { PayloadField } from "@/components/PayloadField";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SelectField } from "@/components/SelectField";
import { FORMAT_OPTIONS } from "@/lib/injection";
import { targetItems } from "@/lib/targetItems";
import type { PayloadFormat } from "@/lib/types";
import type { SendStep } from "@/lib/workflows";
import { requestPreview } from "@/stores/payloadPreviewStore";

export type SendStepFieldsProps = {
  step: SendStep;
  onChange: (step: SendStep) => void;
};

const TARGET_ITEMS = targetItems("Send to");

export const SendStepFields: FC<SendStepFieldsProps> = ({ step, onChange }) => {
  const changePayload = (format: PayloadFormat, payload: string) => {
    onChange({ ...step, format, payload });
    void requestPreview(format, payload);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <SegmentedControl
          ariaLabel="Send target"
          items={TARGET_ITEMS}
          value={step.target}
          onValueChange={(target) => onChange({ ...step, target })}
        />
        <SelectField
          ariaLabel="Payload format"
          className="min-w-0 flex-1"
          value={step.format}
          options={FORMAT_OPTIONS}
          onValueChange={(format) => changePayload(format as PayloadFormat, "")}
        />
      </div>
      <PayloadField
        format={step.format}
        payload={step.payload}
        onChange={(payload) => changePayload(step.format, payload)}
      />
    </div>
  );
};
