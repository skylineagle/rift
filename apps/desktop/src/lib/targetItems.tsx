import { ArrowLeftRight } from "lucide-react";

import type { SegmentItem } from "@/components/SegmentedControl";
import type { Target } from "@/lib/types";

export const targetItems = (verb: string): SegmentItem<Target>[] => [
  { value: "A", label: "A", tip: `${verb} A` },
  {
    value: "Both",
    label: <ArrowLeftRight className="size-[13px]" />,
    tip: `${verb} both`,
  },
  { value: "B", label: "B", tip: `${verb} B` },
];
