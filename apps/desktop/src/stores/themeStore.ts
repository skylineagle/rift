import { createStore } from "@/lib/createStore";

export type Theme = "dark" | "light";

const STORAGE_KEY = "rift-theme";

const readStoredTheme = (): Theme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
};

export const themeStore = createStore<Theme>(readStoredTheme());

applyTheme(themeStore.getState());

export const toggleTheme = () => {
  const next: Theme = themeStore.getState() === "dark" ? "light" : "dark";
  themeStore.setState(() => next);
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
};
