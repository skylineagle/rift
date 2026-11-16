import { Copy, Trash2 } from "lucide-react";
import { useRef, useState, type FC } from "react";

import { StatusDot } from "@/components/StatusDot";
import { useIsRunning, useOverallStatus } from "@/hooks/useBridge";
import { cn } from "@/lib/utils";
import { deleteProfile, duplicateProfile, renameProfile, selectProfile } from "@/stores/profilesStore";

export type ProfileRowProps = { name: string; selected: boolean };

export const ProfileRow: FC<ProfileRowProps> = ({ name, selected }) => {
  const status = useOverallStatus(name);
  const running = useIsRunning(name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const cancelled = useRef(false);

  const finish = () => {
    setEditing(false);
    if (!cancelled.current) void renameProfile(name, draft);
    cancelled.current = false;
  };

  return (
    <div role="button" tabIndex={0} onClick={() => selectProfile(name)}
      onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") selectProfile(name); }}
      className={cn("group grid h-[34px] cursor-default grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2", selected ? "bg-surface-4" : "hover:bg-surface-3")}>
      <StatusDot status={status} />
      {editing ? <input autoFocus aria-label="Profile name" value={draft} onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.stopPropagation()}
        onBlur={finish} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { cancelled.current = true; event.currentTarget.blur(); } if (event.key === "Enter") event.currentTarget.blur(); }}
        className="min-w-0 rounded border border-accent-line bg-surface px-1 text-[13px] outline-none" /> :
        <b className="truncate text-[13px] font-medium" title={running ? "Stop the bridge to rename it" : "Double-click to rename"}
          onDoubleClick={(event) => { event.stopPropagation(); if (!running) { setDraft(name); setEditing(true); } }}>{name}</b>}
      <span className="flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
        <button aria-label={`Copy ${name}`} title="Copy profile" className="p-1 text-fg-3 hover:text-fg" onClick={(event) => { event.stopPropagation(); void duplicateProfile(name); }}><Copy className="size-3.5" /></button>
        <button aria-label={`Delete ${name}`} title="Delete profile" className="p-1 text-fg-3 hover:text-err" onClick={(event) => { event.stopPropagation(); void deleteProfile(name); }}><Trash2 className="size-3.5" /></button>
      </span>
    </div>
  );
};
