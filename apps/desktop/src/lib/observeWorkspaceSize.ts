import { resizeWorkspace } from "@/lib/resizeWorkspace";
import { layoutStore } from "@/stores/layoutStore";

export const observeWorkspaceSize = (element: HTMLElement) => {
  const observer = new ResizeObserver(() => {
    const { api } = layoutStore.getState();
    const { clientWidth, clientHeight } = element;
    if (!api || !clientWidth || !clientHeight) return;
    if (api.width !== clientWidth || api.height !== clientHeight) {
      resizeWorkspace(api, clientWidth, clientHeight);
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
};
