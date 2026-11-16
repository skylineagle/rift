import { Pause, Play } from "lucide-react";
import type { FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import type { SideName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setSideEnabled } from "@/stores/profilesStore";

export type SideToggleProps = {
  profileName: string;
  side: SideName;
  enabled: boolean;
  pending: boolean;
};

export const SideToggle: FC<SideToggleProps> = ({ profileName, side, enabled, pending }) => (
  <TooltipButton
    variant="ghost"
    size="icon"
    aria-pressed={enabled}
    tip={enabled ? `Pause side ${side}` : `Play side ${side}`}
    disabled={pending}
    aria-busy={pending}
    className={cn(
      "size-6 flex-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
      enabled
        ? "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok hover:bg-[color-mix(in_srgb,var(--ok)_24%,transparent)] hover:text-ok active:bg-[color-mix(in_srgb,var(--ok)_30%,transparent)] focus-visible:outline-ok"
        : side === "A"
          ? "bg-ab text-primary-fg hover:bg-[color-mix(in_srgb,var(--ab)_86%,var(--surface))] hover:text-primary-fg active:bg-[color-mix(in_srgb,var(--ab)_76%,var(--surface))] focus-visible:outline-ab"
          : "bg-ba text-primary-fg hover:bg-[color-mix(in_srgb,var(--ba)_86%,var(--surface))] hover:text-primary-fg active:bg-[color-mix(in_srgb,var(--ba)_76%,var(--surface))] focus-visible:outline-ba",
    )}
    onClick={() => setSideEnabled(profileName, side, !enabled)}
  >
    {enabled ? <Pause /> : <Play />}
  </TooltipButton>
);
