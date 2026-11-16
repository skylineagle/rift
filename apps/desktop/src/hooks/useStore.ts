import { useSyncExternalStore } from "react";

import type { Store } from "@/lib/createStore";

export const useStore = <State, Selected>(
  store: Store<State>,
  select: (state: State) => Selected,
): Selected =>
  useSyncExternalStore(store.subscribe, () => select(store.getState()));
