import { useStore } from "@/hooks/useStore";
import { themeStore } from "@/stores/themeStore";

export const useTheme = () => useStore(themeStore, (theme) => theme);
