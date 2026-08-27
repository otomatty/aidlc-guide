import type { DocSection, Locale } from "./types.ts";

/**
 * Display names for directories that carry no `README.md` on disk.
 *
 * The nav categories are the aidlc-workflows directory layout itself — there is
 * no hand-maintained taxonomy. A folder normally names itself through its
 * `README.md` title; this table only covers the folders that have none, so it
 * stays small by construction. Keys are `<section>/<dir-path>` relative to the
 * locale content root.
 */
const FOLDER_LABELS: Record<string, Partial<Record<Locale, string>>> = {
  "reference/04-stages": { en: "Stages", ja: "ステージ" },
  "reference/examples": { en: "Examples", ja: "実例" },
  "reference/research": { en: "Research", ja: "調査資料" },
};

/**
 * Title-case a directory name: drop a numeric ordering prefix (`04-stages`),
 * split on `-`/`_`, capitalise. Last resort when neither a `README.md` nor the
 * label table names the folder.
 */
export function humanizeDirName(name: string): string {
  const words = name
    .replace(/^\d+[-_]/, "")
    .split(/[-_]+/)
    .filter((word) => word !== "");
  if (words.length === 0) return name;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** Display name for a README-less directory node. */
export function folderLabel(section: DocSection, relDir: string, locale: Locale): string {
  const entry = FOLDER_LABELS[`${section}/${relDir}`];
  const labelled = entry?.[locale] ?? entry?.en;
  if (labelled !== undefined) return labelled;
  const name = relDir.slice(relDir.lastIndexOf("/") + 1);
  return humanizeDirName(name);
}
