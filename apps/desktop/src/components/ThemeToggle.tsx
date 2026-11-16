import { Moon, Sun } from "lucide-react";
import type { FC } from "react";

import { TooltipButton } from "@/components/TooltipButton";
import { useTheme } from "@/hooks/useTheme";
import { toggleTheme } from "@/stores/themeStore";

export const ThemeToggle: FC = () => {
  const theme = useTheme();

  return (
    <TooltipButton
      variant="ghost"
      size="icon"
      tip={theme === "dark" ? "Light mode" : "Dark mode"}
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </TooltipButton>
  );
};
