import { type ReactNode, useEffect } from "react";
import { useAppState, useDispatch } from "../store/context.tsx";
import type { Theme } from "../store/state.ts";

/** Click toggles light ↔ dark. Always writes an explicit `data-theme`. */
export function applyTheme(theme: Theme, root: HTMLElement): void {
  root.setAttribute("data-theme", theme);
}

export function nextTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

const LABEL: Readonly<Record<Theme, string>> = {
  light: "テーマ: ライト",
  dark: "テーマ: ダーク",
};

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
      aria-label={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      onClick={() => {
        dispatch({ type: "theme", theme: nextTheme(theme) });
      }}
    >
      <span aria-hidden="true">◐</span> {LABEL[theme]}
    </button>
  );
}
