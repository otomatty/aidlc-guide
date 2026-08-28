#!/usr/bin/env bun
/**
 * Mirror the upstream aidlc-workflows docs tree into the packaged `en` snapshot
 * and re-pin `docs/official-docs.manifest.json`.
 *
 * Usage:
 *   bun scripts/sync-official-docs.ts --upstream <checkout> --upstream-sha <sha>
 *     [--workspace <root>] [--pr-body <file>] [--now <ISO-8601>]
 *
 * The script does no network I/O: `--upstream` is a checkout someone else
 * fetched (the workflow clones it; a human can point at a local clone). That
 * keeps the whole sync a pure filesystem operation, testable and re-runnable.
 *
 * `en` is a mirror — upstream is the source of truth and a page upstream
 * deleted is deleted here, together with its `ja` translation, which would
 * otherwise be served forever with no English original. `ja` is otherwise
 * never touched: it is hand-written and the run fails loud if it drifts by
 * anything other than those orphan deletions.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildDiffReport,
  type DiffEntry,
  formatDiffReport,
  resolveUpstreamDocsRoot,
  walkContentFiles,
} from "../packages/official-docs/src/diff-report.ts";

/**
 * Pages this repository owns inside the mirrored `en` tree. They do not exist
 * upstream and must survive the mirror: `packages/official-docs/src/stage-map.ts`
 * deep-links seven stage slugs at them (`GET /api/official-docs/stage/:slug`),
 * and the anchors those links use (`#approval-gates`, `#feature-scope`) exist
 * only here. Drop one only in the same change that re-points those map entries.
 */
export const LOCAL_ONLY_DOC_PATHS: ReadonlySet<string> = new Set([
  "guide/getting-started.md",
  "reference/scopes.md",
]);

/** Where upstream records the framework version, relative to the checkout root. */
const UPSTREAM_VERSION_REL = path.join("dist", "claude", ".claude", "tools", "aidlc-version.ts");

const AIDLC_VERSION_RE = /export\s+const\s+AIDLC_VERSION\s*=\s*(["'])([^"']+)\1/;

const MANIFEST_REL = path.join("docs", "official-docs.manifest.json");

export type SyncPlan = {
  /** DocPaths to copy from upstream into `docs/<section>/en`. */
  writes: string[];
  /** DocPaths to remove from `docs/<section>/en`. */
  enDeletes: string[];
  /** DocPaths whose `ja` translation is orphaned by an `en` delete. */
  jaDeletes: string[];
  /** DocPaths absent upstream that are kept because this repo owns them. */
  preserved: string[];
};

export type PinnedManifest = {
  sourceVersion: string;
  source: string;
  capturedAt: string;
  upstreamSha?: string;
};

export function parseAidlcVersion(source: string): string | null {
  const match = AIDLC_VERSION_RE.exec(source);
  return match?.[2] ?? null;
}

/**
 * Turn a diff report into the file operations that make `en` match upstream.
 * Pure: every fs decision this script makes is visible here.
 */
export function planSync(
  entries: readonly DiffEntry[],
  localOnly: ReadonlySet<string> = LOCAL_ONLY_DOC_PATHS,
): SyncPlan {
  const plan: SyncPlan = { writes: [], enDeletes: [], jaDeletes: [], preserved: [] };
  for (const entry of entries) {
    switch (entry.status) {
      case "added":
      case "modified":
        plan.writes.push(entry.path);
        break;
      case "removed":
        if (localOnly.has(entry.path)) {
          plan.preserved.push(entry.path);
          break;
        }
        plan.enDeletes.push(entry.path);
        if (entry.jaPresent) plan.jaDeletes.push(entry.path);
        break;
      case "unchanged":
        break;
      default: {
        const exhaustive: never = entry.status;
        throw new Error(`unhandled diff status: ${String(exhaustive)}`);
      }
    }
  }
  return plan;
}

/** `guide/agents/x.md` → `{ section: "guide", relFile: "agents/x.md" }`. */
function splitDocPath(docPath: string): { section: string; relFile: string } {
  const slash = docPath.indexOf("/");
  if (slash < 0) throw new Error(`malformed DocPath: ${docPath}`);
  return { section: docPath.slice(0, slash), relFile: docPath.slice(slash + 1) };
}

function localePath(workspaceRoot: string, docPath: string, locale: "en" | "ja"): string {
  const { section, relFile } = splitDocPath(docPath);
  return path.join(workspaceRoot, "docs", section, locale, ...relFile.split("/"));
}

function upstreamPath(upstreamDocsRoot: string, docPath: string): string {
  const { section, relFile } = splitDocPath(docPath);
  return path.join(upstreamDocsRoot, section, ...relFile.split("/"));
}

/** Snapshot every `ja` file so the run can prove it only removed orphans. */
function jaHashes(workspaceRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const section of ["guide", "reference"]) {
    const files = walkContentFiles(path.join(workspaceRoot, "docs", section, "ja"));
    for (const [rel, hash] of files) out.set(`${section}/${rel}`, hash);
  }
  return out;
}

/**
 * Every `ja` path that differs between two snapshots, in either direction.
 * The mirror is only ever allowed to remove orphans, so anything else here is
 * a bug in this script and must stop the run.
 */
export function jaDrift(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): string[] {
  const drifted = new Set<string>();
  for (const [docPath, hash] of before) {
    if (after.get(docPath) !== hash) drifted.add(docPath);
  }
  for (const docPath of after.keys()) {
    if (!before.has(docPath)) drifted.add(docPath);
  }
  return [...drifted].sort((a, b) => a.localeCompare(b));
}

export function applySync(input: {
  workspaceRoot: string;
  upstreamDocsRoot: string;
  plan: SyncPlan;
}): void {
  const { workspaceRoot, upstreamDocsRoot, plan } = input;
  for (const docPath of plan.writes) {
    const dest = localePath(workspaceRoot, docPath, "en");
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(upstreamPath(upstreamDocsRoot, docPath), dest);
  }
  for (const docPath of plan.enDeletes) {
    rmSync(localePath(workspaceRoot, docPath, "en"), { force: true });
  }
  for (const docPath of plan.jaDeletes) {
    rmSync(localePath(workspaceRoot, docPath, "ja"), { force: true });
  }
}

export function readPinnedManifest(workspaceRoot: string): PinnedManifest | null {
  const file = path.join(workspaceRoot, MANIFEST_REL);
  if (!existsSync(file)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const sourceVersion = record.sourceVersion;
    const source = record.source;
    const capturedAt = record.capturedAt;
    if (
      typeof sourceVersion !== "string" ||
      typeof source !== "string" ||
      typeof capturedAt !== "string"
    ) {
      return null;
    }
    const upstreamSha = record.upstreamSha;
    return {
      sourceVersion,
      source,
      capturedAt,
      ...(typeof upstreamSha === "string" && upstreamSha.trim() !== ""
        ? { upstreamSha: upstreamSha.trim() }
        : {}),
    };
  } catch {
    return null;
  }
}

/** Key order matches the committed file so a re-pin is a minimal diff. */
export function formatManifest(input: {
  sourceVersion: string;
  upstreamSha: string;
  capturedAt: string;
}): string {
  return `${JSON.stringify(
    {
      sourceVersion: input.sourceVersion,
      source: "aidlc-workflows",
      capturedAt: input.capturedAt,
      upstreamSha: input.upstreamSha,
    },
    null,
    2,
  )}\n`;
}

/**
 * PR body: the pin change first (what a reviewer decides on), then the diff
 * report, which already reads as a translate-PR checklist.
 */
export function formatPrBody(input: {
  version: string;
  upstreamSha: string;
  previousVersion: string | null;
  previousSha: string | null;
  plan: SyncPlan;
  report: string;
}): string {
  const lines = [
    "Automated mirror of [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) `v2` docs.",
    "",
    "| Field | Previous | New |",
    "|-------|----------|-----|",
    `| AIDLC_VERSION | ${input.previousVersion ?? "_(none)_"} | ${input.version} |`,
    `| UPSTREAM_SHA | ${input.previousSha ? `\`${input.previousSha}\`` : "_(none)_"} | \`${input.upstreamSha}\` |`,
    "",
    `Changelog: https://github.com/awslabs/aidlc-workflows/blob/v2/CHANGELOG.md`,
    "",
    "## What this PR changed",
    "",
    `- \`en\` pages written: ${input.plan.writes.length}`,
    `- \`en\` pages deleted: ${input.plan.enDeletes.length}`,
    `- \`ja\` orphan translations deleted: ${input.plan.jaDeletes.length}`,
  ];
  if (input.plan.preserved.length > 0) {
    lines.push(
      `- kept (owned by this repo, not upstream): ${input.plan.preserved
        .map((docPath) => `\`${docPath}\``)
        .join(", ")}`,
    );
  }
  lines.push(
    "",
    "## Review checklist",
    "",
    "- [ ] `ja` translations added or refreshed for the added/modified pages below",
    "- [ ] `packages/docs-bridge/data/*.json` `sourceVersion` still accurate for this pin",
    "- [ ] `packages/official-docs/src/stage-map.ts` targets still resolve",
    "",
    "The quality gate (`bun run check`) ran in the sync job before this PR was opened.",
    "",
    "---",
    "",
    input.report,
  );
  return `${lines.join("\n")}`;
}

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

const USAGE = `Usage:
  bun scripts/sync-official-docs.ts --upstream <checkout> --upstream-sha <sha>
    [--workspace <root>] [--pr-body <file>] [--now <ISO-8601>]
`;

function flagValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  const value = argv[idx + 1];
  if (value === undefined || value.startsWith("-")) throw new UsageError();
  return value;
}

function run(argv: string[]): string[] {
  const upstream = flagValue(argv, "--upstream");
  const upstreamSha = flagValue(argv, "--upstream-sha");
  if (upstream === undefined || upstreamSha === undefined) throw new UsageError();

  const workspaceRoot = path.resolve(
    flagValue(argv, "--workspace") ?? path.join(import.meta.dirname, ".."),
  );
  const upstreamRoot = path.resolve(upstream);
  const nowRaw = flagValue(argv, "--now");
  const now = nowRaw === undefined ? new Date() : new Date(nowRaw);
  if (Number.isNaN(now.getTime())) throw new Error(`invalid --now value: ${nowRaw}`);

  const versionFile = path.join(upstreamRoot, UPSTREAM_VERSION_REL);
  if (!existsSync(versionFile)) {
    throw new Error(`upstream checkout has no ${UPSTREAM_VERSION_REL} (looked in ${upstreamRoot})`);
  }
  const version = parseAidlcVersion(readFileSync(versionFile, "utf8"));
  if (version === null) throw new Error(`could not read AIDLC_VERSION from ${versionFile}`);

  const upstreamDocsRoot = resolveUpstreamDocsRoot(upstreamRoot);
  const previous = readPinnedManifest(workspaceRoot);

  // Built before the mirror runs: the report is the record of what changed,
  // so it has to see the old snapshot.
  const report = buildDiffReport({
    workspaceRoot,
    upstreamRoot,
    now,
    workspaceLabel: ".",
    upstreamLabel: `awslabs/aidlc-workflows@${upstreamSha.slice(0, 12)}`,
  });
  const reportMarkdown = formatDiffReport(report);
  const plan = planSync(report.entries);

  const jaBefore = jaHashes(workspaceRoot);
  applySync({ workspaceRoot, upstreamDocsRoot, plan });
  const drift = jaDrift(jaBefore, jaHashes(workspaceRoot));
  const expectedDrift = new Set(plan.jaDeletes);
  const unexpected = drift.filter((docPath) => !expectedDrift.has(docPath));
  if (unexpected.length > 0) {
    throw new Error(`ja tree changed outside orphan cleanup: ${unexpected.join(", ")}`);
  }

  writeFileSync(
    path.join(workspaceRoot, MANIFEST_REL),
    formatManifest({
      sourceVersion: version,
      upstreamSha,
      capturedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    }),
  );

  const reportRel = path.join("docs", "reviews", `official-docs-diff-${version}.md`);
  const reportPath = path.join(workspaceRoot, reportRel);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, reportMarkdown);

  const prBodyPath = flagValue(argv, "--pr-body");
  if (prBodyPath !== undefined) {
    writeFileSync(
      path.resolve(prBodyPath),
      formatPrBody({
        version,
        upstreamSha,
        previousVersion: previous?.sourceVersion ?? null,
        previousSha: previous?.upstreamSha ?? null,
        plan,
        report: reportMarkdown,
      }),
    );
  }

  return [
    `version=${version}`,
    `sha=${upstreamSha}`,
    `previous_version=${previous?.sourceVersion ?? ""}`,
    `previous_sha=${previous?.upstreamSha ?? ""}`,
    `added=${report.counts.added}`,
    `removed=${report.counts.removed}`,
    `modified=${report.counts.modified}`,
    `unchanged=${report.counts.unchanged}`,
    `translate_pending=${report.counts.added + report.counts.modified}`,
    `report=${reportRel.split(path.sep).join("/")}`,
  ];
}

export function runCli(argv: string[]): { status: number; stdout: string; stderr: string } {
  try {
    return { status: 0, stdout: `${run(argv).join("\n")}\n`, stderr: "" };
  } catch (error) {
    if (error instanceof UsageError) return { status: 1, stdout: "", stderr: USAGE };
    const message = error instanceof Error ? error.message : String(error);
    return { status: 1, stdout: "", stderr: `${message}\n` };
  }
}

if (import.meta.main) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  process.exit(result.status);
}
