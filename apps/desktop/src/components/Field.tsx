import type { FC, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export const Field: FC<FieldProps> = ({ label, children, className }) => (
  <div className={cn("flex min-w-0 flex-col gap-1", className)}>
    <label className="text-[10.5px] font-semibold tracking-[0.02em] text-fg-3">
      {label}
    </label>
    {children}
  </div>
);
