export type Store<State> = {
  getState: () => State;
  setState: (update: (state: State) => State) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createStore = <State>(initialState: State): Store<State> => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (update) => {
      const next = update(state);
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
