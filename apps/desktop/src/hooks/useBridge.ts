import { useStore } from "@/hooks/useStore";
import { overallStatus } from "@/lib/sideStatus";
import { bridgeStore, selectBridge } from "@/stores/bridgeStore";

export const useBridge = (name: string) =>
  useStore(bridgeStore, (state) => selectBridge(state, name));

export const useIsRunning = (name: string) =>
  useStore(bridgeStore, (state) => selectBridge(state, name).running);

export const useOverallStatus = (name: string) =>
  useStore(bridgeStore, (state) => {
    const bridge = selectBridge(state, name);
    return overallStatus(bridge.running, [
      bridge.sides.A.status,
      bridge.sides.B.status,
    ]);
  });
