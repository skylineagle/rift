import type { FC } from "react";

import { cn } from "@/lib/utils";

export type LoggingFieldMessageProps = { hint?: string; error?: string };

export const LoggingFieldMessage: FC<LoggingFieldMessageProps> = ({ hint, error }) => {
  const message = error ?? hint;
  return message ? (
    <span className={cn("text-[11px] leading-snug", error ? "text-err" : "text-fg-3")}>{message}</span>
  ) : null;
};
