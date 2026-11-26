import type { FC } from "react";

import { DurationFields } from "@/components/DurationFields";
import type { WaitDraft } from "@/lib/workflows";

export type WaitStepFieldsProps = {
  step: WaitDraft;
  onChange: (step: WaitDraft) => void;
};

export const WaitStepFields: FC<WaitStepFieldsProps> = ({ step, onChange }) => (
  <DurationFields
    label="Duration"
    duration={step}
    onChange={(duration) => onChange({ action: "wait", ...duration })}
  />
);
