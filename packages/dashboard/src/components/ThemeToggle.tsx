import { syncDocumentTheme } from "@m3-baseui/react-tailwind";
import { MoonIcon, SunIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppState, useDispatch } from "../store/context.tsx";
import type { Theme } from "../store/state.ts";
import { isVsCodeWebview, watchVsCodeTheme } from "../theme/host.ts";

const DEFAULT_SEED = "#6750A4";

export function nextTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

/**
 * Apply light/dark to the document via M3 syncDocumentTheme.
 * Also mirrors the legacy `dark` class for any leftover selectors.
 */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): () => void {
  root.classList.toggle("dark", theme === "dark");
  return syncDocumentTheme({ mode: theme, seed: DEFAULT_SEED, root });
}

/**
 * Browser: optional light/dark toggle via M3 syncDocumentTheme (default seed).
 * VS Code webview: follows the editor theme (no toggle).
 */
export function ThemeToggle(): ReactNode {
  const { theme } = useAppState();
  const dispatch = useDispatch();
  const vscode = isVsCodeWebview();

  useEffect(() => {
    if (vscode) return watchVsCodeTheme();
    return applyTheme(theme);
  }, [theme, vscode]);

  if (vscode) return null;

  const toDark = theme === "light";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-testid="theme-toggle"
      aria-pressed={theme === "dark"}
      aria-label={toDark ? "ダークテーマに切り替え" : "ライトテーマに切り替え"}
      title={toDark ? "ダークテーマ" : "ライトテーマ"}
      onClick={() => {
        dispatch({ type: "theme", theme: nextTheme(theme) });
      }}
    >
      {toDark ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}
