#!/usr/bin/env bun
// Quality-gate guard: no workflow history may sit in an IGNORED audit shard.
//
// `.gitignore` drops audit shards from the ephemeral remote runner (`vm-*.md`)
// because a container mints a fresh clone-id every session, so each session
// would commit a brand new file — unbounded growth, and in practice nothing but
// HUMAN_TURN / SESSION_* bookkeeping, since those sessions do GitHub-issue work
// rather than running `/aidlc`.
//
// The objection to that rule is the right one (Codex review on PR #18): the day
// such a session DOES run `/aidlc`, git would silently omit real audit history,
// and "unless someone notices" is not a plan. This makes it impossible not to
// notice — the gate fails, names the file, and prints the command that fixes
// it. The ignore rule stays a default, not a decision made once and forgotten.
//
// Runs from `bun run check`. On a fresh clone (CI) no ignored shard exists, so
// this is a no-op there; its job is the local tree, where the shard is written.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Events that mean the shard records real workflow, not just session chatter. */
const WORKFLOW_EVENT = /^\*\*Event\*\*: (STAGE_|GATE_|ARTIFACT_|SENSOR_|LEARNING_|UNIT_)/m;

function git(...args: string[]): string {
  const run = spawnSync("git", args, { encoding: "utf-8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr.trim()}`);
  return run.stdout;
}

function ignoredShards(root: string): string[] {
  // `--others --ignored` lists exactly what git is NOT tracking, which is the
  // set this guard is about — asking git directly rather than re-implementing
  // the ignore rules (a second copy would drift from `.gitignore`).
  const listed = git(
    "-C",
    root,
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    "aidlc/spaces/*/intents/*/audit/*.md",
  );
  return listed.split("\n").filter((line) => line.length > 0);
}

export function findOmittedHistory(root: string): string[] {
  return ignoredShards(root).filter((relPath) => {
    try {
      return WORKFLOW_EVENT.test(readFileSync(join(root, relPath), "utf-8"));
    } catch {
      // Unreadable is not "has history" — a read failure here must not fail the
      // whole gate on a file git already considers untracked.
      return false;
    }
  });
}

if (import.meta.main) {
  const root = process.cwd();
  const omitted = findOmittedHistory(root);
  if (omitted.length === 0) process.exit(0);

  console.error("audit shards: ignored shard(s) contain real workflow history.");
  console.error("");
  console.error("These hold STAGE_/GATE_/ARTIFACT_/SENSOR_ events — the record every timing");
  console.error("view is derived from — but git is ignoring them, so committing would drop");
  console.error("them silently. Commit them deliberately:");
  console.error("");
  for (const relPath of omitted) console.error(`  git add -f ${relPath}`);
  console.error("");
  process.exit(1);
}
