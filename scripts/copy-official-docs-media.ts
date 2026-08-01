/**
 * Copy packaged official-docs snapshot into the VS Code extension media tree.
 * Layout: media/official-docs/docs/{guide,reference,official-docs.manifest.json}
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const dest = join(root, "packages/vscode-extension/media/official-docs/docs");

rmSync(join(root, "packages/vscode-extension/media/official-docs"), {
  recursive: true,
  force: true,
});
mkdirSync(dest, { recursive: true });
cpSync(join(root, "docs/guide"), join(dest, "guide"), { recursive: true });
cpSync(join(root, "docs/reference"), join(dest, "reference"), { recursive: true });
cpSync(join(root, "docs/official-docs.manifest.json"), join(dest, "official-docs.manifest.json"));

console.log(`copied official docs → ${dest}`);
