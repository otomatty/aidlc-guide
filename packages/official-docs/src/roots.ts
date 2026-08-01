import path from "node:path";
import type { DocPath, DocSection, Locale } from "./types.ts";

const SECTIONS = new Set<DocSection>(["guide", "reference"]);

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "ja";
}

export function isDocSection(value: string): value is DocSection {
  return SECTIONS.has(value as DocSection);
}

/**
 * Split a public DocPath into section + file relative to the locale content root.
 * Returns null when the path is not a well-formed `guide|reference/…` DocPath.
 */
export function parseDocPath(
  raw: string,
): { section: DocSection; relFile: string; docPath: DocPath } | null {
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (normalized === "" || normalized.includes("\0")) return null;

  const slash = normalized.indexOf("/");
  if (slash <= 0) return null;

  const section = normalized.slice(0, slash);
  if (!isDocSection(section)) return null;

  const relFile = normalized.slice(slash + 1);
  if (relFile === "" || relFile.endsWith("/")) return null;

  return { section, relFile, docPath: `${section}/${relFile}` };
}

/** Absolute locale content root: `docs/<section>/<locale>/`. */
export function localeContentRoot(
  workspaceRoot: string,
  section: DocSection,
  locale: Locale,
): string {
  return path.resolve(workspaceRoot, "docs", section, locale);
}

/** Absolute `docs/` directory used as guard root for the manifest file. */
export function docsRoot(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, "docs");
}
