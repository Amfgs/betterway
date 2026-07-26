import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readStoredValue, storageKeys } from "../utils/storageKeys";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoredValue(storageKeys.theme, storageKeys.legacyTheme, "dark"));
  const transitionInProgress = useRef(false);

  useEffect(() => {
    localStorage.setItem(storageKeys.theme, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const changeTheme = useCallback((nextTheme, origin) => {
    if (transitionInProgress.current) return;

    const root = document.documentElement;
    const currentTheme = root.classList.contains("dark") ? "dark" : "light";
    if (nextTheme === currentTheme) {
      setTheme(nextTheme);
      return;
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const supportsViewTransition = !reducedMotion && typeof document.startViewTransition === "function";
    const target = origin?.currentTarget || origin?.target;
    const bounds = target?.getBoundingClientRect?.();
    const x = Number(origin?.x ?? (bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2));
    const y = Number(origin?.y ?? (bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2));
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 24;
    const directionClass = nextTheme === "dark" ? "theme-to-dark" : "theme-to-light";
    let pulse;
    const apply = () => {
      root.classList.toggle("dark", nextTheme === "dark");
      setTheme(nextTheme);
    };
    const finish = () => {
      transitionInProgress.current = false;
      root.classList.remove("theme-transitioning");
      root.classList.remove("theme-view-transition");
      root.classList.remove("theme-to-dark");
      root.classList.remove("theme-to-light");
    };

    root.style.setProperty("--theme-transition-x", `${x}px`);
    root.style.setProperty("--theme-transition-y", `${y}px`);
    root.style.setProperty("--theme-transition-radius", `${Math.ceil(radius)}px`);

    transitionInProgress.current = true;
    root.classList.add("theme-transitioning", directionClass);

    if (!reducedMotion && !supportsViewTransition) {
      pulse = document.createElement("span");
      pulse.className = `theme-transition-pulse ${directionClass}`;
      pulse.setAttribute("aria-hidden", "true");
      pulse.style.left = `${x}px`;
      pulse.style.top = `${y}px`;
      document.body.appendChild(pulse);
      pulse.addEventListener("animationend", () => pulse.remove(), { once: true });
      window.setTimeout(() => pulse?.remove(), 700);
    }

    if (supportsViewTransition) {
      try {
        root.classList.add("theme-view-transition");
        const transition = document.startViewTransition(apply);
        transition.finished.then(finish, finish);
        return;
      } catch {
        root.classList.remove("theme-view-transition");
      }
    }

    if (!reducedMotion) {
      const wash = document.createElement("span");
      wash.className = `theme-transition-wash theme-transition-wash-${nextTheme}`;
      wash.setAttribute("aria-hidden", "true");
      document.body.appendChild(wash);
      window.requestAnimationFrame(() => wash.classList.add("active"));
      window.setTimeout(apply, 190);
      window.setTimeout(() => {
        wash.classList.add("finished");
        window.setTimeout(() => wash.remove(), 180);
      }, 410);
      window.setTimeout(finish, 560);
      return;
    }
    apply();
    finish();
  }, []);

  const toggleTheme = useCallback((origin) => {
    changeTheme(theme === "dark" ? "light" : "dark", origin);
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
