import { useState, type FC } from "react";

import { renameProfile } from "@/stores/profilesStore";

export type ProfileNameInputProps = { name: string; locked: boolean };

export const ProfileNameInput: FC<ProfileNameInputProps> = ({ name, locked }) => {
  const [draft, setDraft] = useState(name);

  const commit = async () => {
    const renamed = await renameProfile(name, draft);
    if (!renamed) setDraft(name);
  };

  return (
    <input
      aria-label="Profile name"
      value={draft}
      readOnly={locked}
      spellCheck={false}
      title={locked ? "Stop the bridge to rename it" : undefined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      className="-ml-1.5 w-[300px] rounded-md border border-transparent bg-transparent px-1.5 py-[3px] text-[15px] font-[650] tracking-[-0.012em] text-fg transition-[border-color,background-color] duration-100 outline-none hover:border-line-2 focus:border-accent-line focus:bg-surface-2 read-only:hover:border-transparent"
    />
  );
};
