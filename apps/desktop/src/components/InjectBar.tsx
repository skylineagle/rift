import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeftRight, File, Send } from "lucide-react";
import { useRef, useState, type FC } from "react";
import { toast } from "@yusufceng1z/ding-react";

import { InjectHistory } from "@/components/InjectHistory";
import {
  InjectPreview,
  type InjectPreviewResult,
} from "@/components/InjectPreview";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SelectField } from "@/components/SelectField";
import { TooltipButton } from "@/components/TooltipButton";
import { useIsRunning } from "@/hooks/useBridge";
import { useStore } from "@/hooks/useStore";
import { errorMessage } from "@/lib/format";
import { FORMAT_OPTIONS, PLACEHOLDERS, fileName } from "@/lib/injection";
import * as api from "@/lib/tauriApi";
import type { PayloadFormat, Target } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  injectHistoryStore,
  rememberInjection,
  selectHistory,
  type InjectHistoryEntry,
} from "@/stores/injectHistoryStore";

export type InjectBarProps = { profileName: string };

const TARGET_ITEMS = [
  { value: "A" as const, label: "A", tip: "Inject into A" },
  {
    value: "Both" as const,
    label: <ArrowLeftRight className="size-[13px]" />,
    tip: "Inject into both",
  },
  { value: "B" as const, label: "B", tip: "Inject into B" },
];

const EMPTY_PREVIEW: InjectPreviewResult = { bytes: [], error: null };

export const InjectBar: FC<InjectBarProps> = ({ profileName }) => {
  const running = useIsRunning(profileName);
  const history = useStore(injectHistoryStore, (state) =>
    selectHistory(state, profileName),
  );
  const [target, setTarget] = useState<Target>("B");
  const [format, setFormat] = useState<PayloadFormat>("text");
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<InjectPreviewResult>(EMPTY_PREVIEW);
  const latestPreview = useRef(0);

  const isFile = format === "file";
  const canSend = isFile
    ? value.length > 0
    : !preview.error && (preview.bytes?.length ?? 0) > 0;

  const validate = async (nextFormat: PayloadFormat, nextValue: string) => {
    const ticket = ++latestPreview.current;
    if (nextFormat === "file") return setPreview(EMPTY_PREVIEW);
    try {
      const bytes = await api.previewPayload(nextFormat, nextValue);
      if (ticket === latestPreview.current) setPreview({ bytes, error: null });
    } catch (error) {
      if (ticket === latestPreview.current) {
        setPreview({ bytes: null, error: errorMessage(error) });
      }
    }
  };

  const edit = (nextFormat: PayloadFormat, nextValue: string) => {
    setFormat(nextFormat);
    setValue(nextValue);
    validate(nextFormat, nextValue);
  };

  const send = async (entry: InjectHistoryEntry) => {
    if (!running) {
      toast.info("Start the bridge to inject");
      return false;
    }
    try {
      await api.inject(profileName, entry.target, entry.format, entry.value);
      rememberInjection(profileName, entry);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const submit = async () => {
    if (!canSend) return;
    await send({ target, format, value });
  };

  const load = (entry: InjectHistoryEntry) => {
    setTarget(entry.target);
    edit(entry.format, entry.value);
  };

  const chooseFile = async () => {
    const path = await open({ multiple: false, directory: false });
    if (typeof path === "string") edit("file", path);
  };

  const handleKeyDown = (key: string, preventDefault: () => void) => {
    if (key === "Enter") {
      preventDefault();
      submit();
    } else if (key === "ArrowUp" && !value && history[0]) {
      preventDefault();
      load(history[0]);
    }
  };

  return (
    <div className="flex items-center gap-1.5 border-t border-line bg-surface-2 px-3 py-2">
      <SegmentedControl
        ariaLabel="Inject target"
        items={TARGET_ITEMS}
        value={target}
        onValueChange={setTarget}
      />
      <SelectField
        ariaLabel="Payload format"
        className="w-[84px] flex-none"
        value={format}
        options={FORMAT_OPTIONS}
        onValueChange={(next) => edit(next as PayloadFormat, "")}
      />
      <div
        className={cn(
          "flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-lg border bg-surface px-2.5 transition-[border-color,box-shadow] duration-100 focus-within:border-accent-line focus-within:ring-[3px] focus-within:ring-accent-soft",
          preview.error ? "border-err ring-[3px] ring-err-soft" : "border-line-2",
        )}
      >
        <span className="font-mono text-sm font-bold text-accent-text">›</span>
        {isFile ? (
          <button
            type="button"
            onClick={chooseFile}
            className="flex flex-1 items-center gap-[7px] bg-transparent p-0 text-left font-mono text-[12.5px] text-fg-2"
          >
            <File className="size-[13px]" />
            <span className="truncate">{value ? fileName(value) : "Choose file…"}</span>
          </button>
        ) : (
          <input
            aria-label="Bytes to inject"
            value={value}
            placeholder={PLACEHOLDERS[format]}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => edit(format, event.target.value)}
            onKeyDown={(event) =>
              handleKeyDown(event.key, () => event.preventDefault())
            }
            className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-[12.5px] text-fg outline-none"
          />
        )}
      </div>
      <InjectPreview result={preview} />
      <InjectHistory entries={history} onLoad={load} onResend={send} />
      <TooltipButton
        size="icon"
        tip="Send (Enter)"
        disabled={!canSend}
        onClick={submit}
      >
        <Send />
      </TooltipButton>
    </div>
  );
};
