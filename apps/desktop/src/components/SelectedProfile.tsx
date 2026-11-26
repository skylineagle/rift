import type { FC, ReactNode } from "react";

import { useSelectedProfile } from "@/hooks/useProfiles";
import type { Profile } from "@/lib/types";

export type SelectedProfileProps = { children: (profile: Profile) => ReactNode };

export const SelectedProfile: FC<SelectedProfileProps> = ({ children }) => {
  const profile = useSelectedProfile();
  return profile ? children(profile) : null;
};
