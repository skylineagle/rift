import { exitReorder, isReordering, layoutStore, setHeld } from "@/stores/layoutStore";

const HOLD_DELAY_MS = 200;

export const attachReorderKeys = (target: Window) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const release = () => {
    clearTimeout(timer);
    setHeld(false);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isReordering(layoutStore.getState())) {
      event.preventDefault();
      clearTimeout(timer);
      exitReorder();
      return;
    }
    if (event.key !== "Alt" || event.ctrlKey || event.metaKey || event.shiftKey) {
      release();
      return;
    }
    event.preventDefault();
    if (event.repeat) return;
    clearTimeout(timer);
    timer = setTimeout(() => setHeld(true), HOLD_DELAY_MS);
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key !== "Alt") return;
    event.preventDefault();
    release();
  };

  target.addEventListener("keydown", handleKeyDown, true);
  target.addEventListener("keyup", handleKeyUp, true);
  target.addEventListener("blur", release);

  return () => {
    release();
    target.removeEventListener("keydown", handleKeyDown, true);
    target.removeEventListener("keyup", handleKeyUp, true);
    target.removeEventListener("blur", release);
  };
};
