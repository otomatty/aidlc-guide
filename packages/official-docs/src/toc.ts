import { readdir } from "node:fs/promises";
import path from "node:path";
import { guardPath, readBounded, withResult } from "@aidlc-guide/core-utils";
import type { ReadResult } from "@aidlc-guide/shared-types";
import { extractTitle } from "./markdown.ts";
import { isLocale, localeContentRoot } from "./roots.ts";
import type { DocPath, DocSection, Locale, TocNode, TocTree } from "./types.ts";

async function listMarkdownRel(contentRoot: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(absDir: string, relDir: string): Promise<void> {
    const entries = await readdir(absDir, { withFileTypes: true }).catch(() => null);
    if (entries === null) return;
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of sorted) {
      if (entry.name.startsWith(".")) continue;
      const rel = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const guarded = await guardPath(contentRoot, rel);
      if (!("ok" in guarded)) continue;
      out.push(rel.replace(/\\/g, "/"));
    }
  }

  await walk(contentRoot, "");
  return out;
}

async function titleFor(
  workspaceRoot: string,
  section: DocSection,
  locale: Locale,
  relFile: string,
  enFallback: Map<string, string>,
): Promise<string> {
  const contentRoot = localeContentRoot(workspaceRoot, section, locale);
  const guarded = await guardPath(contentRoot, relFile);
  if ("ok" in guarded) {
    const bounded = await readBounded(guarded.value);
    if (bounded.ok) {
      const title = extractTitle(bounded.value);
      if (title !== undefined) return title;
    }
  }
  return enFallback.get(relFile) ?? path.basename(relFile, ".md");
}

async function loadEnTitles(
  workspaceRoot: string,
  section: DocSection,
  relFiles: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const contentRoot = localeContentRoot(workspaceRoot, section, "en");
  for (const rel of relFiles) {
    const guarded = await guardPath(contentRoot, rel);
    if (!("ok" in guarded)) continue;
    const bounded = await readBounded(guarded.value);
    if (!bounded.ok) continue;
    const title = extractTitle(bounded.value);
    if (title !== undefined) map.set(rel, title);
  }
  return map;
}

/**
 * Build a flat-but-hierarchical TOC for one section.
 * En structure is authoritative when the requested locale is sparse (F2).
 */
async function sectionToc(
  workspaceRoot: string,
  section: DocSection,
  locale: Locale,
): Promise<TocNode[]> {
  const enRoot = localeContentRoot(workspaceRoot, section, "en");
  const localeRoot = localeContentRoot(workspaceRoot, section, locale);

  const enFiles = await listMarkdownRel(enRoot);
  const localeFiles = locale === "en" ? enFiles : await listMarkdownRel(localeRoot);

  // Prefer en inventory; union any locale-only pages.
  const ordered = [...enFiles];
  for (const rel of localeFiles) {
    if (!ordered.includes(rel)) ordered.push(rel);
  }

  const enTitles = await loadEnTitles(workspaceRoot, section, ordered);
  const nodes: TocNode[] = [];

  for (const rel of ordered) {
    const docPath: DocPath = `${section}/${rel}`;
    const title = await titleFor(workspaceRoot, section, locale, rel, enTitles);
    nodes.push({
      id: docPath,
      title,
      path: docPath,
      children: [],
    });
  }

  return nodes;
}

/**
 * Scan guide + reference trees for a locale (F2).
 * Returns a non-empty tree when the workspace snapshot has content.
 */
export async function listToc(
  workspaceRoot: string,
  locale: Locale | (string & {}),
): Promise<ReadResult<TocTree>> {
  return withResult(async () => {
    if (!isLocale(locale)) {
      return { error: true, reason: "path_rejected" };
    }

    const guide = await sectionToc(workspaceRoot, "guide", locale);
    const reference = await sectionToc(workspaceRoot, "reference", locale);

    return {
      ok: true,
      value: { guide, reference },
    };
  });
}
