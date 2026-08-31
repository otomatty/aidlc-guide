/**
 * Copy packaged official-docs snapshot into the VS Code extension media tree.
 * Layout: media/official-docs/docs/{<section>…,official-docs.manifest.json}
 *
 * Section list comes from the package, so a section added there is packaged
 * without touching this script — a snapshot missing a section would otherwise
 * serve an installed VSIX an empty nav for it with no build-time signal.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DOC_SECTIONS } from "../packages/official-docs/src/roots.ts";

const root = join(import.meta.dirname, "..");
const dest = join(root, "packages/vscode-extension/media/official-docs/docs");

rmSync(join(root, "packages/vscode-extension/media/official-docs"), {
  recursive: true,
  force: true,
});
mkdirSync(dest, { recursive: true });
const missing: string[] = [];
for (const section of DOC_SECTIONS) {
  const from = join(root, "docs", section);
  if (!existsSync(from)) {
    missing.push(section);
    continue;
  }
  cpSync(from, join(dest, section), { recursive: true });
}
cpSync(join(root, "docs/official-docs.manifest.json"), join(dest, "official-docs.manifest.json"));

if (missing.length > 0) {
  // Fail the build rather than ship a VSIX whose nav is silently short a book.
  console.error(`missing official-docs section(s) under docs/: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`copied official docs (${DOC_SECTIONS.join(", ")}) → ${dest}`);
