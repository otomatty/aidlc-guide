/**
 * Upstream vs packaged-snapshot diff for official docs (US-08 / FR-U6).
 *
 * Layout contract (pinned for Bolt 5):
 * - Upstream (aidlc-workflows checkout): `docs/guide/**` + `docs/reference/**`
 *   (English source; no locale segment).
 * - Snapshot (this repo): `docs/guide/en/**` + `docs/reference/en/**`
 *   plus optional `docs/.../ja/**` for translation follow-up.
 * - Keys are public DocPaths: `guide/…` or `reference/…`.
 *
 * Report format: Markdown suitable as translate-PR input (see `formatDiffReport`).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { DocPath, DocSection, Manifest } from "./types.ts";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface DiffEntry {
  path: DocPath;
  status: DiffStatus;
  /** Whether `docs/<section>/ja/<rel>` exists in the snapshot workspace. */
  jaPresent: boolean;
}

export interface DiffReport {
  generatedAt: string;
  workspaceRoot: string;
  upstreamRoot: string;
  /** Optional display labels (e.g. repo-relative) for Markdown headers. */
  workspaceLabel?: string;
  upstreamLabel?: string;
  snapshotManifest: Manifest | null;
  entries: DiffEntry[];
  counts: Record<DiffStatus, number>;
}

export interface BuildDiffReportInput {
  workspaceRoot: string;
  /** Absolute path to an aidlc-workflows checkout (or any tree with docs/guide + docs/reference). */
  upstreamRoot: string;
  /** Override clock for tests. */
  now?: Date;
  workspaceLabel?: string;
  upstreamLabel?: string;
}

const SECTIONS: readonly DocSection[] = ["guide", "reference"];

const SKIP_NAMES = new Set([".gitkeep", ".DS_Store"]);

function isSkippedName(name: string): boolean {
  return SKIP_NAMES.has(name) || name.startsWith(".");
}

/** Walk a content root; return map of relative POSIX paths → sha256 hex. */
export function walkContentFiles(contentRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(contentRoot)) return out;

  const stack: string[] = [contentRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (isSkippedName(name)) continue;
      const abs = path.join(dir, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!st.isFile()) continue;
      const rel = path.relative(contentRoot, abs).split(path.sep).join("/");
      if (rel === "" || rel.includes("\0")) continue;
      const body = readFileSync(abs);
      out.set(rel, createHash("sha256").update(body).digest("hex"));
    }
  }
  return out;
}

function readSnapshotManifest(workspaceRoot: string): Manifest | null {
  const abs = path.join(workspaceRoot, "docs", "official-docs.manifest.json");
  if (!existsSync(abs)) return null;
  try {
    const raw = JSON.parse(readFileSync(abs, "utf8")) as Record<string, unknown>;
    const sourceVersion = raw.sourceVersion;
    const source = raw.source;
    const capturedAt = raw.capturedAt;
    if (
      typeof sourceVersion !== "string" ||
      sourceVersion.trim() === "" ||
      typeof source !== "string" ||
      source.trim() === "" ||
      typeof capturedAt !== "string" ||
      capturedAt.trim() === ""
    ) {
      return null;
    }
    return {
      sourceVersion: sourceVersion.trim(),
      source: source.trim(),
      capturedAt: capturedAt.trim(),
    };
  } catch {
    return null;
  }
}

function jaExists(workspaceRoot: string, section: DocSection, relFile: string): boolean {
  return existsSync(path.join(workspaceRoot, "docs", section, "ja", relFile));
}

/**
 * Resolve upstream docs root: prefer `<upstream>/docs`, else treat upstream as the docs root
 * when it already contains `guide/` and/or `reference/`.
 */
export function resolveUpstreamDocsRoot(upstreamRoot: string): string {
  const nested = path.join(upstreamRoot, "docs");
  if (existsSync(path.join(nested, "guide")) || existsSync(path.join(nested, "reference"))) {
    return nested;
  }
  if (
    existsSync(path.join(upstreamRoot, "guide")) ||
    existsSync(path.join(upstreamRoot, "reference"))
  ) {
    return upstreamRoot;
  }
  return nested;
}

function emptyCounts(): Record<DiffStatus, number> {
  return { added: 0, removed: 0, modified: 0, unchanged: 0 };
}

export function buildDiffReport(input: BuildDiffReportInput): DiffReport {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const upstreamRoot = path.resolve(input.upstreamRoot);
  const upstreamDocs = resolveUpstreamDocsRoot(upstreamRoot);

  const upstream = new Map<DocPath, string>();
  const snapshot = new Map<DocPath, string>();

  for (const section of SECTIONS) {
    const upFiles = walkContentFiles(path.join(upstreamDocs, section));
    for (const [rel, hash] of upFiles) {
      upstream.set(`${section}/${rel}`, hash);
    }
    const snapFiles = walkContentFiles(path.join(workspaceRoot, "docs", section, "en"));
    for (const [rel, hash] of snapFiles) {
      snapshot.set(`${section}/${rel}`, hash);
    }
  }

  const allPaths = new Set<DocPath>([...upstream.keys(), ...snapshot.keys()]);
  const sorted = [...allPaths].sort((a, b) => a.localeCompare(b));
  const counts = emptyCounts();
  const entries: DiffEntry[] = [];

  for (const docPath of sorted) {
    const upHash = upstream.get(docPath);
    const snapHash = snapshot.get(docPath);
    let status: DiffStatus;
    if (upHash === undefined) status = "removed";
    else if (snapHash === undefined) status = "added";
    else if (upHash === snapHash) status = "unchanged";
    else status = "modified";

    const slash = docPath.indexOf("/");
    const section = docPath.slice(0, slash) as DocSection;
    const relFile = docPath.slice(slash + 1);
    const jaPresent = jaExists(workspaceRoot, section, relFile);

    counts[status] += 1;
    entries.push({ path: docPath, status, jaPresent });
  }

  const now = input.now ?? new Date();
  return {
    generatedAt: now.toISOString(),
    workspaceRoot,
    upstreamRoot,
    workspaceLabel: input.workspaceLabel,
    upstreamLabel: input.upstreamLabel,
    snapshotManifest: readSnapshotManifest(workspaceRoot),
    entries,
    counts,
  };
}

function jaNote(entry: DiffEntry): string {
  if (entry.status === "removed") {
    return entry.jaPresent ? "ja present (orphan translation?)" : "ja absent";
  }
  if (entry.status === "unchanged") {
    return entry.jaPresent ? "ja present" : "ja missing";
  }
  // added | modified — primary translate-PR signal
  return entry.jaPresent ? "ja present — review for refresh" : "ja missing — needs translation";
}

/**
 * Markdown report pinned for Bolt 5 / US-08.
 * Usable as translate-PR body or attached checklist input.
 */
export function formatDiffReport(report: DiffReport): string {
  const { counts } = report;
  const workspaceShown = report.workspaceLabel ?? report.workspaceRoot;
  const upstreamShown = report.upstreamLabel ?? report.upstreamRoot;
  const lines: string[] = [
    "# Official docs diff report",
    "",
    `- generatedAt: \`${report.generatedAt}\``,
    `- workspace: \`${workspaceShown}\``,
    `- upstream: \`${upstreamShown}\``,
  ];

  if (report.snapshotManifest) {
    const m = report.snapshotManifest;
    lines.push(
      `- snapshotManifest: source=\`${m.source}\` sourceVersion=\`${m.sourceVersion}\` capturedAt=\`${m.capturedAt}\``,
    );
  } else {
    lines.push("- snapshotManifest: _(missing or invalid)_");
  }

  lines.push(
    "",
    "## Summary",
    "",
    "| Status | Count |",
    "|--------|------:|",
    `| added | ${counts.added} |`,
    `| removed | ${counts.removed} |`,
    `| modified | ${counts.modified} |`,
    `| unchanged | ${counts.unchanged} |`,
    "",
  );

  const byStatus = (status: DiffStatus): DiffEntry[] =>
    report.entries.filter((e) => e.status === status);

  const renderList = (title: string, status: DiffStatus, emptyNote: string): void => {
    lines.push(`## ${title}`, "");
    const list = byStatus(status);
    if (list.length === 0) {
      lines.push(emptyNote, "");
      return;
    }
    for (const entry of list) {
      lines.push(`- \`${entry.path}\` — ${jaNote(entry)}`);
    }
    lines.push("");
  };

  renderList("Added (in upstream, not in snapshot en)", "added", "_None._");
  renderList("Removed (in snapshot en, not in upstream)", "removed", "_None._");
  renderList("Modified (content hash differs)", "modified", "_None._");

  lines.push(
    "## Unchanged",
    "",
    counts.unchanged === 0
      ? "_None._"
      : `${counts.unchanged} file(s) identical between upstream and snapshot \`en\`.`,
    "",
    "## Translate-PR checklist",
    "",
    "- [ ] Review **added** and **modified** English pages above",
    "- [ ] Add or refresh `docs/guide|reference/ja/**` counterparts (US-07)",
    "- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated",
    "- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)",
    "",
  );

  return `${lines.join("\n")}`;
}
