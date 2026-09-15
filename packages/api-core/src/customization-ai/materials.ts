import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { guardPath } from "@aidlc-guide/reader-core";
import type { CustomizationAiMaterial } from "@aidlc-guide/shared-types";

const PHASES = new Set(["initialization", "ideation", "inception", "construction", "operation"]);
const MAX_FILES = 500;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Lists workflow deliverables only. No audit, state, hidden directory, or application source. */
async function candidates(root: string, spaceId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(spaceId)) throw new Error("bad-request");
  const relative = `aidlc/spaces/${spaceId}/intents`;
  const guarded = await guardPath(root, relative);
  if (!("ok" in guarded)) return [];
  const found: Array<CustomizationAiMaterial & { relative: string }> = [];
  const records = await readdir(guarded.value, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  const visit = async (dir: string, depth: number) => {
    if (depth > 7 || found.length >= MAX_FILES) return;
    const safe = await guardPath(root, dir);
    if (!("ok" in safe)) return;
    for (const entry of await readdir(safe.value, { withFileTypes: true })) {
      if (found.length >= MAX_FILES) break;
      if (
        entry.name.startsWith(".") ||
        entry.name === "memory.md" ||
        entry.name === "audit" ||
        entry.isSymbolicLink()
      )
        continue;
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await visit(child, depth + 1);
      else if (entry.isFile() && /\.(md|txt)$/i.test(entry.name)) {
        found.push({
          id: `material-${sha(child).slice(0, 32)}`,
          title: entry.name,
          origin: child.slice(relative.length + 1),
          relative: child,
        });
      }
    }
  };
  for (const record of records.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!record.isDirectory() || record.isSymbolicLink() || record.name.startsWith(".")) continue;
    const recordPath = `${relative}/${record.name}`;
    const safe = await guardPath(root, recordPath);
    if (!("ok" in safe)) continue;
    for (const entry of await readdir(safe.value, { withFileTypes: true }))
      if (entry.isDirectory() && PHASES.has(entry.name) && !entry.isSymbolicLink())
        await visit(`${recordPath}/${entry.name}`, 0);
  }
  return found;
}

export async function listCustomizationMaterials(
  root: string,
  spaceId: string,
): Promise<CustomizationAiMaterial[]> {
  return (await candidates(root, spaceId)).map(({ id, title, origin }) => ({ id, title, origin }));
}

export async function readCustomizationMaterials(root: string, spaceId: string, ids: string[]) {
  const selection = new Set(ids.filter((id) => id.startsWith("material-")));
  if (selection.size === 0) return [];
  if (selection.size > 8) throw new Error("too-many-materials");
  const available = await candidates(root, spaceId);
  const result: Array<{ id: string; title: string; hash: string; content: string }> = [];
  for (const id of selection) {
    const material = available.find((entry) => entry.id === id);
    if (!material) throw new Error("material-not-found");
    const safe = await guardPath(root, material.relative);
    if (!("ok" in safe)) throw new Error("material-not-found");
    const stat = await lstat(safe.value);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
      throw new Error("material-too-large");
    const content = await readFile(safe.value);
    if (content.byteLength > 1024 * 1024) throw new Error("material-too-large");
    result.push({
      id,
      title: `${material.origin}`,
      hash: sha(content),
      content: content.toString("utf8"),
    });
  }
  return result;
}
