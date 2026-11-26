import type { FC, ReactNode } from "react";

import { PanelShield } from "@/components/PanelShield";
import { useStore } from "@/hooks/useStore";
import type { PanelId } from "@/lib/panels";
import { isReordering, layoutStore } from "@/stores/layoutStore";

export type DockPanelProps = { panelId: PanelId; children: ReactNode };

export const DockPanel: FC<DockPanelProps> = ({ panelId, children }) => {
  const reordering = useStore(layoutStore, isReordering);

  return (
    <div data-panel-id={panelId} className="relative h-full min-h-0 min-w-0">
      <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        {children}
      </div>
      {reordering && <PanelShield panelId={panelId} />}
    </div>
  );
};
