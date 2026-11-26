import { toast } from "@yusufceng1z/ding-react";
import { X } from "lucide-react";
import { useState, type FC, type FormEvent } from "react";

import { LoggingDestinationTabs } from "@/components/LoggingDestinationTabs";
import { LoggingFooter } from "@/components/LoggingFooter";
import { LoggingGeneralSection } from "@/components/LoggingGeneralSection";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/format";
import { isDirty, toConfig, toDraft, validateDraft, type LoggingDraft } from "@/lib/loggingSettings";
import type { LoggingConfig } from "@/lib/types";
import { saveLoggingSettings } from "@/stores/loggingStore";

export type LoggingSettingsDialogProps = {
  saved: LoggingConfig;
  defaultDirectory: string;
  onClose: () => void;
};

export const LoggingSettingsDialog: FC<LoggingSettingsDialogProps> = ({
  saved,
  defaultDirectory,
  onClose,
}) => {
  const [draft, setDraft] = useState(() => toDraft(saved));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = validateDraft(draft);
  const canSave = !saving && Object.keys(errors).length === 0 && isDirty(draft, saved);

  const change = (changes: Partial<LoggingDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setFailure(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await saveLoggingSettings(toConfig(draft, saved));
      toast.success("Logging settings saved");
      onClose();
    } catch (error) {
      const message = errorMessage(error);
      setFailure(message);
      toast.error(message);
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
      <header className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0 flex-1">
          <DialogTitle>Logging</DialogTitle>
          <DialogDescription>Where Rift writes connection, traffic and profile events.</DialogDescription>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" aria-label="Close" className="-mr-1.5">
            <X />
          </Button>
        </DialogClose>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LoggingGeneralSection draft={draft} errors={errors} onChange={change} />
        <LoggingDestinationTabs
          draft={draft}
          errors={errors}
          defaultDirectory={defaultDirectory}
          onChange={change}
        />
      </div>
      <LoggingFooter
        saved={saved}
        defaultDirectory={defaultDirectory}
        canSave={canSave}
        failure={failure}
      />
    </form>
  );
};
