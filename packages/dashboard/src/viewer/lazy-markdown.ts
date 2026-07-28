import { lazy } from "react";

/**
 * The one lazy wrapper for the markdown renderer, so every consumer splits on
 * the same chunk (P-AV-1) instead of cloning this four-line block.
 */
export const MarkdownSurface = lazy(async () => {
  const mod = await import("./MarkdownSurface.tsx");
  return { default: mod.MarkdownSurface };
});
