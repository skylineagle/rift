import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "@yusufceng1z/ding-react";
import { FolderOpen } from "lucide-react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/format";
import { logFilePaths } from "@/lib/loggingSettings";
import type { LoggingConfig } from "@/lib/types";

export type LoggingFooterProps = {
  saved: LoggingConfig;
  defaultDirectory: string;
  canSave: boolean;
  failure: string | null;
};

export const LoggingFooter: FC<LoggingFooterProps> = ({
  saved,
  defaultDirectory,
  canSave,
  failure,
}) => {
  const openLogFolder = async () => {
    const { directory, current } = logFilePaths(saved, defaultDirectory);
    try {
      await revealItemInDir(current).catch(() => revealItemInDir(directory));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <footer className="border-t border-line bg-surface-2 px-4 py-2.5">
      {failure && (
        <p role="alert" data-selectable className="mb-2 text-[11.5px] break-words text-err">
          {failure}
        </p>
      )}
      <div className="flex items-center gap-2">
        {saved.file.enabled && (
          <Button type="button" variant="ghost" className="-ml-2" onClick={openLogFolder}>
            <FolderOpen />
            Open log folder
          </Button>
        )}
        <span className="flex-1" />
        <DialogClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={!canSave}>Save</Button>
      </div>
    </footer>
  );
};
