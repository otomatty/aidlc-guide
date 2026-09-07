import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Source entry points and installed dist/*.mjs share this resolver; cwd is the user's project. */
export function bundledDocsRoot(entryUrl: string): string {
  const directory = path.dirname(fileURLToPath(entryUrl));
  const packaged = path.resolve(directory, "../media/official-docs");
  return existsSync(path.join(packaged, "docs/official-docs.manifest.json"))
    ? packaged
    : path.resolve(directory, "../../..");
}
