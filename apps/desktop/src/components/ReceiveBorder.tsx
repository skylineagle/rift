import { useCallback, type FC } from "react";

import { attachReceiveActivity } from "@/lib/receiveActivity";
import type { SideName } from "@/lib/types";

export type ReceiveBorderProps = {
  profileName: string;
  side: SideName;
};

export const ReceiveBorder: FC<ReceiveBorderProps> = ({ profileName, side }) => {
  const attach = useCallback(
    (element: HTMLDivElement | null) =>
      element ? attachReceiveActivity(element, profileName, side) : undefined,
    [profileName, side],
  );

  return <div ref={attach} aria-hidden="true" className="receive-border" />;
};
