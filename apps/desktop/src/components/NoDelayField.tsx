import type { FC } from "react";

import { OnOffField } from "@/components/OnOffField";

export type NoDelayFieldProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export const NoDelayField: FC<NoDelayFieldProps> = ({ value, onValueChange }) => (
  <OnOffField label="TCP no delay" value={value} onValueChange={onValueChange} />
);
