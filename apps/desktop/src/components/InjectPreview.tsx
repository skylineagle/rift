import { AlertTriangle } from "lucide-react";
import type { FC } from "react";

import { Hint } from "@/components/Hint";
import { hexString } from "@/lib/format";

export type InjectPreviewResult = { bytes: number[] | null; error: string | null };

export type InjectPreviewProps = { result: InjectPreviewResult };

export const InjectPreview: FC<InjectPreviewProps> = ({ result }) => {
  const { bytes, error } = result;
  if (error) {
    return (
      <Hint text={error}>
        <span className="flex min-w-[38px] justify-end text-err">
          <AlertTriangle className="size-3" />
        </span>
      </Hint>
    );
  }
  if (!bytes?.length) return <span className="min-w-[38px]" />;
  return (
    <Hint text={hexString(bytes, 24)}>
      <span className="min-w-[38px] text-right font-mono text-[11.5px] whitespace-nowrap text-fg-3">
        {bytes.length} B
      </span>
    </Hint>
  );
};
