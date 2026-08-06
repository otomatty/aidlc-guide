/**
 * US-08 / FR-U6: compare upstream aidlc-workflows docs tree vs committed snapshot.
 *
 * Usage:
 *   bun scripts/official-docs-diff.ts --upstream <aidlc-workflows-checkout>
 *   bun scripts/official-docs-diff.ts --upstream <path> --out docs/reviews/official-docs-diff-demo.md
 *   bun scripts/official-docs-diff.ts --upstream <path> --workspace <repo-root>
 *
 * Upstream layout: `<upstream>/docs/guide/**` + `<upstream>/docs/reference/**`
 * Snapshot layout: `docs/guide/en/**` + `docs/reference/en/**`
 * Output: Markdown report usable as translate-PR input (format pinned in
 * `packages/official-docs/src/diff-report.ts` + FD artifact).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildDiffReport, formatDiffReport } from "../packages/official-docs/src/diff-report.ts";

function flagValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  return argv[idx + 1];
}

function usage(): never {
  console.error(`Usage: bun scripts/official-docs-diff.ts --upstream <path> [--out <file>] [--workspace <root>] [--now <ISO-8601>]

Compare upstream aidlc-workflows docs (guide + reference) against the packaged
snapshot under docs/guide|reference/en and print a Markdown translate-PR report.`);
  process.exit(1);
}

function relTo(from: string, target: string): string {
  const rel = path.relative(from, target).split(path.sep).join("/");
  return rel === "" ? "." : rel;
}

const argv = process.argv.slice(2);
const upstream = flagValue(argv, "--upstream");
if (!upstream || upstream.startsWith("-")) usage();

const workspaceRoot = path.resolve(
  flagValue(argv, "--workspace") ?? path.join(import.meta.dirname, ".."),
);
const outPath = flagValue(argv, "--out");
const nowRaw = flagValue(argv, "--now");
const now = nowRaw ? new Date(nowRaw) : undefined;
if (nowRaw && now !== undefined && Number.isNaN(now.getTime())) {
  console.error(`Invalid --now value: ${nowRaw}`);
  process.exit(1);
}

const upstreamRoot = path.resolve(upstream);
const report = buildDiffReport({
  workspaceRoot,
  upstreamRoot,
  now,
  workspaceLabel: relTo(process.cwd(), workspaceRoot),
  upstreamLabel: relTo(process.cwd(), upstreamRoot),
});
const markdown = formatDiffReport(report);

if (outPath) {
  const abs = path.resolve(outPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, markdown, "utf8");
  console.log(`wrote ${abs}`);
  console.log(
    `summary: added=${report.counts.added} removed=${report.counts.removed} modified=${report.counts.modified} unchanged=${report.counts.unchanged}`,
  );
} else {
  process.stdout.write(markdown);
}
