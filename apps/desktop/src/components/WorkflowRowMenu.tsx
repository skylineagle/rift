import { Copy, Ellipsis, Trash2 } from "lucide-react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workflow } from "@/lib/types";
import { deleteWorkflow, duplicateWorkflow } from "@/lib/workflowActions";

export type WorkflowRowMenuProps = { profileName: string; workflow: Workflow };

export const WorkflowRowMenu: FC<WorkflowRowMenuProps> = ({ profileName, workflow }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`More actions for ${workflow.name}`}
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
      >
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => void duplicateWorkflow(profileName, workflow)}>
        <Copy />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="destructive"
        onSelect={() => void deleteWorkflow(profileName, workflow)}
      >
        <Trash2 />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
