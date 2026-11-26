import type { FC } from "react";

import { useStore } from "@/hooks/useStore";
import { PANEL_TITLES } from "@/lib/panels";
import { layoutStore } from "@/stores/layoutStore";

export const DropPreview: FC = () => {
  const drag = useStore(layoutStore, (state) => state.drag);
  if (!drag) return null;

  return (
    <>
      {drag.preview && (
        <div
          className="pointer-events-none fixed z-40 border border-amber bg-accent-soft"
          style={{
            left: drag.preview.left,
            top: drag.preview.top,
            width: drag.preview.width,
            height: drag.preview.height,
          }}
        />
      )}
      <div
        className="pointer-events-none fixed z-50 rounded-md border border-amber bg-surface-3 px-2.5 py-0.5 text-xs"
        style={{ left: drag.x + 10, top: drag.y + 10 }}
      >
        {PANEL_TITLES[drag.source]}
      </div>
    </>
  );
};
