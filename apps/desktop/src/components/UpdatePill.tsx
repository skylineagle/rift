import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";
import type { FC } from "react";

import { UpdateReadyPill } from "@/components/UpdateReadyPill";
import { useStore } from "@/hooks/useStore";
import { RELEASES_URL, updateStore } from "@/stores/updateStore";

const PILL =
  "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap";

export const UpdatePill: FC = () => {
  const update = useStore(updateStore, (state) => state);

  if (update.status === "ready") {
    return <UpdateReadyPill version={update.version} pillClassName={PILL} />;
  }
  if (update.status === "installing") {
    return (
      <span className={`${PILL} border-line-2 bg-surface-3 text-fg-2`}>
        <span className="size-3 animate-spin rounded-full border-[1.5px] border-fg-3 border-t-fg" />
        Installing {update.version}…
      </span>
    );
  }
  if (update.status === "failed") {
    return (
      <button
        type="button"
        title={update.message}
        className={`${PILL} border-err/35 bg-err-soft text-err`}
        onClick={() => openUrl(RELEASES_URL)}
      >
        Rift {update.version} · Download from releases
        <ExternalLink className="size-3" />
      </button>
    );
  }
  return null;
};
