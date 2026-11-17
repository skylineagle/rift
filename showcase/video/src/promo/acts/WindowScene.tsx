import type { FC } from "react";

import { swapIn } from "../../kit/move";
import type { Placement } from "../layout";
import { AppWindow, type WindowState } from "../ui/AppWindow";

export type WindowSceneProps = { t: number; start: number; end: number; placement: Placement; state: (t: number) => WindowState };

export const WindowScene: FC<WindowSceneProps> = ({ t, start, end, placement, state }) => {
  const look = swapIn(t, start, end);
  if (!look.visible) return null;
  return <AppWindow placement={{ ...placement, y: placement.y + (1 - look.opacity) * 24 }} state={state(t)} style={{ opacity: look.opacity, filter: look.filter }} />;
};
