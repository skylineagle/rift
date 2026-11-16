import { useStore } from "@/hooks/useStore";
import { profilesStore } from "@/stores/profilesStore";

export const useProfiles = () =>
  useStore(profilesStore, (state) => state.profiles);

export const useSelectedProfile = () =>
  useStore(profilesStore, (state) =>
    state.profiles.find((profile) => profile.name === state.selectedName),
  );

export const useIsStale = (name: string) =>
  useStore(profilesStore, (state) => state.staleNames.includes(name));
