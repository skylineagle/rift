import type { FC } from "react";

import { cn } from "@/lib/utils";

export type JumpButtonProps = {
  label: string | null;
  onClick: () => void;
};

export const JumpButton: FC<JumpButtonProps> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    tabIndex={label ? 0 : -1}
    className={cn(
      "absolute bottom-2.5 left-1/2 h-7 -translate-x-1/2 rounded-[14px] border border-line-2 bg-material px-3 text-xs font-medium text-fg shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
      label ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
    )}
  >
    {label}
  </button>
);
