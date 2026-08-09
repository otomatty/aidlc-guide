/**
 * Map VS Code webview CSS variables onto an M3 Scheme ("R G B" channel triples).
 * Unmapped roles fall back to a seed scheme derived from the workbench button color.
 */
import { generateScheme, type Scheme } from "@m3-baseui/react-tailwind";

function cssToTriple(cssColor: string): string | null {
  const probe = document.createElement("span");
  probe.style.color = cssColor;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(resolved);
  if (!match) return null;
  return `${match[1]} ${match[2]} ${match[3]}`;
}

function vscodeTriple(varName: string, fallback?: string): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (raw) {
    const triple = cssToTriple(raw);
    if (triple) return triple;
  }
  if (fallback) {
    const fb = getComputedStyle(document.documentElement).getPropertyValue(fallback).trim();
    if (fb) return cssToTriple(fb);
  }
  return null;
}

function hexFromTriple(triple: string): string {
  const [r, g, b] = triple.split(/\s+/).map((n) => Number(n));
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r ?? 0)}${h(g ?? 0)}${h(b ?? 0)}`;
}

/** Build a full M3 scheme that tracks the active VS Code workbench colors. */
export function schemeFromVsCode(mode: "light" | "dark"): Scheme {
  const primary =
    vscodeTriple("--vscode-button-background") ??
    vscodeTriple("--vscode-focusBorder") ??
    "103 80 164";
  const base = generateScheme(hexFromTriple(primary), "tonalSpot", "standard");
  const scheme = { ...(mode === "dark" ? base.dark : base.light) };

  const assign = (role: keyof Scheme, ...vars: string[]) => {
    for (const name of vars) {
      const triple = vscodeTriple(name);
      if (triple) {
        scheme[role] = triple;
        return;
      }
    }
  };

  assign("background", "--vscode-editor-background");
  assign("onBackground", "--vscode-editor-foreground");
  assign("surface", "--vscode-sideBar-background", "--vscode-editor-background");
  assign("onSurface", "--vscode-sideBar-foreground", "--vscode-editor-foreground");
  assign("surfaceContainer", "--vscode-sideBar-background", "--vscode-editor-background");
  assign("surfaceContainerHigh", "--vscode-input-background", "--vscode-sideBar-background");
  assign("surfaceContainerHighest", "--vscode-input-background");
  assign("surfaceVariant", "--vscode-input-background");
  assign("onSurfaceVariant", "--vscode-descriptionForeground", "--vscode-foreground");
  assign("primary", "--vscode-button-background");
  assign("onPrimary", "--vscode-button-foreground");
  assign("secondary", "--vscode-button-secondaryBackground", "--vscode-input-background");
  assign("onSecondary", "--vscode-button-secondaryForeground", "--vscode-input-foreground");
  assign("secondaryContainer", "--vscode-button-secondaryBackground", "--vscode-input-background");
  assign("error", "--vscode-errorForeground");
  assign("outline", "--vscode-panel-border", "--vscode-widget-border", "--vscode-input-border");
  assign("outlineVariant", "--vscode-widget-border", "--vscode-input-border");
  assign("inverseSurface", "--vscode-editorWidget-background", "--vscode-editor-background");
  assign("inverseOnSurface", "--vscode-editorWidget-foreground", "--vscode-editor-foreground");

  return scheme;
}
