import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "@yusufceng1z/ding-react";
import type { FC } from "react";

import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/format";

export type LogDirectoryFieldProps = {
  directory: string | undefined;
  defaultDirectory: string;
  onDirectoryChange: (directory: string | undefined) => void;
};

export const LogDirectoryField: FC<LogDirectoryFieldProps> = ({
  directory,
  defaultDirectory,
  onDirectoryChange,
}) => {
  const browse = async () => {
    try {
      const path = await open({ directory: true, defaultPath: directory ?? defaultDirectory });
      if (typeof path === "string") onDirectoryChange(path);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Field label="Directory" className="col-span-full">
      <div className="flex gap-1.5">
        <Input
          readOnly
          aria-label="Directory"
          title={directory ?? defaultDirectory}
          className="text-ellipsis font-mono"
          value={directory ?? ""}
          placeholder={defaultDirectory}
        />
        <Button type="button" variant="secondary" onClick={browse}>Browse…</Button>
      </div>
      {directory !== undefined && (
        <button
          type="button"
          onClick={() => onDirectoryChange(undefined)}
          className="self-start bg-transparent p-0 text-[11px] font-medium text-fg-3 transition-colors hover:text-fg"
        >
          Reset to default
        </button>
      )}
    </Field>
  );
};
