import type { FC } from "react";

import { ReorderToggleButton } from "@/components/ReorderToggleButton";
import { ResetLayoutButton } from "@/components/ResetLayoutButton";
import { useSelectedProfile } from "@/hooks/useProfiles";

export const LayoutControls: FC = () =>
  useSelectedProfile() ? (
    <>
      <ResetLayoutButton />
      <ReorderToggleButton />
    </>
  ) : null;
