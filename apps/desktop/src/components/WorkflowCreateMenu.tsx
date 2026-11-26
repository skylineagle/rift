import { FileText, History, Plus, Repeat } from "lucide-react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/hooks/useStore";
import type { Profile } from "@/lib/types";
import { blankWorkflow, workflowFromInjection, workflowNames } from "@/lib/workflows";
import { injectHistoryStore, selectHistory } from "@/stores/injectHistoryStore";
import { openEditor } from "@/stores/workflowPanelStore";

export type WorkflowCreateMenuProps = {
  profile: Profile;
  onRepeatSend: () => void;
};

export const WorkflowCreateMenu: FC<WorkflowCreateMenuProps> = ({ profile, onRepeatSend }) => {
  const latest = useStore(injectHistoryStore, (state) => selectHistory(state, profile.name)[0]);
  const names = workflowNames(profile.workflows ?? []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="New workflow">
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={(profile.workflows ?? []).length === 0}
          onSelect={onRepeatSend}
        >
          <Repeat />
          Repeat a send…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openEditor(profile.name, blankWorkflow(names), null)}>
          <FileText />
          Blank workflow
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!latest}
          onSelect={() =>
            latest && openEditor(profile.name, workflowFromInjection(latest, names), null)
          }
        >
          <History />
          From last injection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
