import { Upload } from "lucide-react";
import { useRef, type FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import { importConfigFile } from "@/lib/configImport";

export const ImportConfigButton: FC = () => {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <TooltipButton variant="ghost" size="icon" tip="Import configuration" onClick={() => input.current?.click()}>
        <Upload />
      </TooltipButton>
      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) importConfigFile(file);
          event.currentTarget.value = "";
        }}
      />
    </>
  );
};
