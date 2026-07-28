import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { MarkdownDoc, MarkdownItem, ReadResult } from "@aidlc-guide/shared-types";

/** Safe guide filenames under `docs/guides/` (no path segments). */
const GUIDE_FILE = /^[a-z0-9][a-z0-9-]*\.md$/i;

/** Preferred order; anything else follows alphabetically. */
const PREFERRED_ORDER = [
  "README.md",
  "getting-started.md",
  "reading-workflow.md",
  "configuring-docs.md",
  "side-questions.md",
  "browser-dashboard.md",
  "live-share.md",
  "async-sharing.md",
] as const;

function guidesDir(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, "docs", "guides");
}

function titleFromMarkdown(text: string, fallback: string): string {
  for (const line of text.split(/\r?\n/)) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match?.[1] !== undefined) return match[1].trim();
  }
  return fallback.replace(/\.md$/i, "").replace(/-/g, " ");
}

function sortGuides(names: string[]): string[] {
  const rank = new Map(PREFERRED_ORDER.map((name, index) => [name.toLowerCase(), index]));
  return [...names].sort((a, b) => {
    const ra = rank.get(a.toLowerCase()) ?? PREFERRED_ORDER.length;
    const rb = rank.get(b.toLowerCase()) ?? PREFERRED_ORDER.length;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

export async function listGuides(workspaceRoot: string): Promise<ReadResult<MarkdownItem[]>> {
  const dir = guidesDir(workspaceRoot);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return { ok: true, value: [], warnings: [`docs/guides not found under ${workspaceRoot}`] };
  }

  const names = sortGuides(entries.filter((name) => GUIDE_FILE.test(name)));
  const guides: MarkdownItem[] = [];
  for (const name of names) {
    try {
      const text = await readFile(path.join(dir, name), "utf8");
      guides.push({ name, title: titleFromMarkdown(text, name) });
    } catch {
      // Skip unreadable files rather than failing the whole catalogue.
    }
  }
  return { ok: true, value: guides };
}

export async function readGuide(
  workspaceRoot: string,
  name: string,
): Promise<ReadResult<MarkdownDoc>> {
  if (!GUIDE_FILE.test(name)) {
    return { error: true, reason: "not-found" };
  }
  const dir = guidesDir(workspaceRoot);
  const file = path.resolve(dir, name);
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { error: true, reason: "not-found" };
  }
  try {
    const markdown = await readFile(file, "utf8");
    return {
      ok: true,
      value: { name, title: titleFromMarkdown(markdown, name), markdown },
    };
  } catch {
    return { error: true, reason: "not-found" };
  }
}
