import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (theme === "system" ? resolvedTheme : theme) ?? "dark";
  const isDark = current === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-foreground backdrop-blur-xl transition-all hover:bg-white/10 dark:border-white/10"
    >
      {mounted ? (
        isDark ? <Moon size={14} /> : <Sun size={14} />
      ) : (
        <span className="block h-3.5 w-3.5" />
      )}
    </button>
  );
};

export default ThemeToggle;