import type { RiftEvent, SideName } from "@/lib/types";
import { subscribeToEvents } from "@/stores/eventStream";

const ACTIVITY_MS = 650;

export const attachReceiveActivity = (
  element: HTMLElement,
  profileName: string,
  side: SideName,
  subscribe: (listener: (event: RiftEvent) => void) => () => void = subscribeToEvents,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    element.removeAttribute("data-receiving");
  };
  const receive = (event: RiftEvent) => {
    if (event.type !== "data" || event.origin !== "received" || event.profile !== profileName || event.source !== side || document.hidden) return;
    element.setAttribute("data-receiving", "true");
    clearTimeout(timer);
    timer = setTimeout(clear, ACTIVITY_MS);
  };
  const visibility = () => {
    if (document.hidden) clear();
  };
  const unsubscribe = subscribe(receive);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", visibility);
    clear();
  };
};
