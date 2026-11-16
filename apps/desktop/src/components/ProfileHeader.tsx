import type { FC } from "react";

export type ProfileHeaderProps = { name: string };

export const ProfileHeader: FC<ProfileHeaderProps> = ({ name }) => (
  <div className="px-3.5 pt-2 pb-0.5 text-[15px] font-[650]">{name}</div>
);
