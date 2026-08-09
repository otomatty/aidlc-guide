/**
 * VS Code webview host detection + M3 theme sync via syncDocumentTheme.
 */
import { syncDocumentTheme } from "@m3-baseui/react-tailwind";
import { schemeFromVsCode } from "./vscode-scheme.ts";

type HostWindow = { acquireVsCodeApi?: unknown };

export function isVsCodeWebview(win: HostWindow = window as HostWindow): boolean {
  return typeof win.acquireVsCodeApi === "function";
}

/** True when the webview body class indicates a dark (or dark HC) theme. */
export function isVsCodeDarkBody(body: Element): boolean {
  const classes = body.classList;
  if (classes.contains("vscode-high-contrast-light")) return false;
  if (classes.contains("vscode-high-contrast")) return true;
  return classes.contains("vscode-dark");
}

/**
 * Mark the document as VS Code-hosted and sync M3 theme from the body class.
 * Returns a disposer for the theme layer.
 */
export function applyVsCodeHost(
  root: HTMLElement = document.documentElement,
  body: Element = document.body,
): () => void {
  root.setAttribute("data-host", "vscode");
  return syncVsCodeTheme(root, body);
}

/**
 * One-shot mirror of the VS Code body theme onto M3 `:root` vars + `data-theme`.
 * Prefer `watchVsCodeTheme` for live updates.
 */
export function syncVsCodeTheme(
  root: HTMLElement = document.documentElement,
  body: Element = document.body,
): () => void {
  root.setAttribute("data-host", "vscode");
  const mode = isVsCodeDarkBody(body) ? "dark" : "light";
  root.classList.toggle("dark", mode === "dark");
  return syncDocumentTheme({
    mode,
    colors: schemeFromVsCode(mode),
    root,
  });
}

/**
 * Keep M3 `:root` colors in lockstep with the VS Code color theme.
 * Returns an unsubscribe that also disposes the theme layer.
 */
export function watchVsCodeTheme(
  root: HTMLElement = document.documentElement,
  body: Element = document.body,
): () => void {
  let disposeTheme = applyVsCodeHost(root, body);
  const observer = new MutationObserver(() => {
    disposeTheme();
    disposeTheme = syncVsCodeTheme(root, body);
  });
  observer.observe(body, { attributes: true, attributeFilter: ["class"] });
  return () => {
    observer.disconnect();
    disposeTheme();
  };
}
