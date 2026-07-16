import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readStoredValue, storageKeys } from "../utils/storageKeys";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredValue(storageKeys.theme, storageKeys.legacyTheme, "dark"));

  useEffect(() => {
    localStorage.setItem(storageKeys.theme, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const changeTheme = useCallback((nextTheme) => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const apply = () => setTheme(nextTheme);

    if (!reducedMotion && document.startViewTransition) {
      root.classList.add("theme-transitioning");
      const transition = document.startViewTransition(apply);
      transition.finished.finally(() => root.classList.remove("theme-transitioning"));
      return;
    }

    root.classList.add("theme-transitioning");
    apply();
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 460);
  }, []);

  const toggleTheme = useCallback(() => {
    changeTheme(theme === "dark" ? "light" : "dark");
  }, [changeTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme: changeTheme
    }),
    [changeTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro de ThemeProvider");
  return context;
}
