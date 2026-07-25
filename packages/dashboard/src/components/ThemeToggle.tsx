import { type ReactNode, useEffect } from "react";
import { useAppState, useDispatch } from "../store/context.tsx";
import type { Theme } from "../store/state.ts";

/**
 * `data-theme` on `<html>` overrides `prefers-color-scheme` in both
 * directions (design-system-mapping): the attribute has to win whichever way
 * the OS is set, so `system` removes it rather than writing a guess.
 */
const ORDER: readonly Theme[] = ["system", "light", "dark"];

const LABEL: Readonly<Record<Theme, string>> = {
  system: "テーマ: システム",
  light: "テーマ: ライト",
  dark: "テーマ: ダーク",
};

export function applyTheme(theme: Theme, root: HTMLElement): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function nextTheme(theme: Theme): Theme {
  const index = ORDER.indexOf(theme);
  return ORDER[(index + 1) % ORDER.length] ?? "system";
}

export function ThemeToggle(): ReactNode {
  const { theme } = useAppState();
  const dispatch = useDispatch();

  useEffect(() => {
    applyTheme(theme, document.documentElement);
  }, [theme]);

  return (
    <button
      type="button"
      className="button"
      data-testid="theme-toggle"
      aria-pressed={theme === "dark"}
      onClick={() => {
        dispatch({ type: "theme", theme: nextTheme(theme) });
      }}
    >
      <span aria-hidden="true">◐</span> {LABEL[theme]}
    </button>
  );
}
