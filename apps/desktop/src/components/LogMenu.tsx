import { Download, Eraser, Filter, MoreHorizontal } from "lucide-react";
import type { FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type LogMenuProps = {
  injectedOnly: boolean;
  onInjectedOnlyChange: (injectedOnly: boolean) => void;
  onExport: () => void;
  onClear: () => void;
};

export const LogMenu: FC<LogMenuProps> = ({
  injectedOnly,
  onInjectedOnlyChange,
  onExport,
  onClear,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <TooltipButton variant="ghost" size="icon" tip="More log actions">
        <MoreHorizontal />
      </TooltipButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-[190px]">
      <DropdownMenuCheckboxItem
        checked={injectedOnly}
        onCheckedChange={onInjectedOnlyChange}
      >
        <Filter />
        Injected only
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onExport}>
        <Download />
        Export log…
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onSelect={onClear}>
        <Eraser />
        Clear log
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
