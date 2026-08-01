import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Packaged snapshot lives at `media/official-docs/` and contains a `docs/`
 * tree (guide|reference + manifest). Fall back to the workspace root when the
 * snapshot is missing (e.g. F5 before `build:extension` in the monorepo).
 */
export function resolveOfficialDocsRoot(extensionPath: string, workspaceRoot: string): string {
  const packaged = path.join(extensionPath, "media", "official-docs");
  const manifest = path.join(packaged, "docs", "official-docs.manifest.json");
  return existsSync(manifest) ? packaged : workspaceRoot;
}
