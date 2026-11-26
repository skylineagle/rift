import { open } from "@tauri-apps/plugin-dialog";
import { File } from "lucide-react";
import type { FC } from "react";

import { InjectPreview } from "@/components/InjectPreview";
import { useStore } from "@/hooks/useStore";
import { PLACEHOLDERS, fileName } from "@/lib/injection";
import type { PayloadFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { payloadPreviewStore, selectPreview } from "@/stores/payloadPreviewStore";

export type PayloadFieldProps = {
  format: PayloadFormat;
  payload: string;
  onChange: (payload: string) => void;
};

export const PayloadField: FC<PayloadFieldProps> = ({ format, payload, onChange }) => {
  const preview = useStore(payloadPreviewStore, (state) => selectPreview(state, format, payload));

  const chooseFile = async () => {
    const path = await open({ multiple: false, directory: false });
    if (typeof path === "string") onChange(path);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        className={cn(
          "flex h-7 min-w-0 items-center gap-2 rounded-[7px] border bg-surface px-[9px] focus-within:border-accent-line focus-within:ring-[3px] focus-within:ring-accent-soft",
          preview.error ? "border-err" : "border-line-2",
        )}
      >
        {format === "file" ? (
          <button
            type="button"
            title={payload}
            onClick={chooseFile}
            className="flex min-w-0 flex-1 items-center gap-[7px] bg-transparent p-0 text-left font-mono text-xs text-fg-2"
          >
            <File className="size-[13px] flex-none" />
            <span className="truncate">{payload ? fileName(payload) : "Choose file…"}</span>
          </button>
        ) : (
          <input
            aria-label="Payload"
            aria-invalid={!!preview.error}
            value={payload}
            placeholder={PLACEHOLDERS[format]}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-fg outline-none"
          />
        )}
        {!preview.error && <InjectPreview result={preview} />}
      </div>
      {preview.error && <p className="m-0 text-[11px] leading-snug text-err">{preview.error}</p>}
    </div>
  );
};
