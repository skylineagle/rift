import { DockviewReact, type DockviewReadyEvent, type DockviewTheme } from "dockview-react";
import { useCallback, useRef, type FC } from "react";

import { DropPreview } from "@/components/DropPreview";
import { EndpointsDockPanel } from "@/components/EndpointsDockPanel";
import { InjectDockPanel } from "@/components/InjectDockPanel";
import { LogDockPanel } from "@/components/LogDockPanel";
import { ProfilesDockPanel } from "@/components/ProfilesDockPanel";
import { WorkflowsDockPanel } from "@/components/WorkflowsDockPanel";
import { connectWorkspace, watchPanelVisibility } from "@/lib/connectWorkspace";
import { observeWorkspaceSize } from "@/lib/observeWorkspaceSize";
import type { PanelId } from "@/lib/panels";
import { attachReorderKeys } from "@/lib/reorderKeys";
import { exitReorder } from "@/stores/layoutStore";
import "dockview/dist/styles/dockview.css";

const COMPONENTS: Record<PanelId, FC> = {
  profiles: ProfilesDockPanel,
  endpoints: EndpointsDockPanel,
  log: LogDockPanel,
  workflows: WorkflowsDockPanel,
  inject: InjectDockPanel,
};

const THEME: DockviewTheme = { name: "rift", className: "dockview-theme-rift" };

export const DockWorkspace: FC = () => {
  const workspace = useRef<HTMLDivElement | null>(null);

  const attach = useCallback((element: HTMLDivElement | null) => {
    workspace.current = element ?? workspace.current;
    if (!element) return;
    const detachKeys = attachReorderKeys(window);
    const unwatchPanels = watchPanelVisibility();
    const unobserveSize = observeWorkspaceSize(element);
    return () => {
      detachKeys();
      unwatchPanels();
      unobserveSize();
      exitReorder();
    };
  }, []);

  const handleReady = ({ api }: DockviewReadyEvent) =>
    connectWorkspace(api, () => workspace.current!.getBoundingClientRect());

  return (
    <div ref={attach} data-workspace className="min-h-0 flex-1">
      <DockviewReact
        components={COMPONENTS}
        onReady={handleReady}
        theme={THEME}
        disableDnd
        disableAutoResizing
        disableFloatingGroups
      />
      <DropPreview />
    </div>
  );
};
