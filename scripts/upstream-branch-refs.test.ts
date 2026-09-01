/**
 * Repo-wide guard: nothing may hardcode upstream aidlc-workflows' branch name.
 *
 * Upstream shipped from `v2` until GA moved the default branch to `main` and
 * deleted `v2`. Every place that had written `v2` down broke at once and none
 * of them failed loudly: the docs-sync workflow's `ls-remote refs/heads/v2`
 * returned nothing, so the pin froze, and the `blob/v2/...` links already in
 * the shipped docs and in the extension's "open the official steps" fallback
 * started 404ing. This test is the tripwire for the next rename.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

const SCAN_ROOTS = ["docs", "packages", "scripts", join(".github", "workflows")] as const;

const SCAN_EXT = [".md", ".ts", ".tsx", ".yml", ".yaml", ".json"];
const SKIP_DIR = new Set(["node_modules", "dist", "coverage", "out", ".git"]);

/** This guard spells the forbidden literals out, so tests are not scanned. */
function isScannable(rel: string): boolean {
  if (rel.includes(".test.")) return false;
  return SCAN_EXT.some((ext) => rel.endsWith(ext));
}

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      yield* walk(abs);
      continue;
    }
    if (isScannable(relative(root, abs))) yield abs;
  }
}

function scan(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    for (const file of walk(join(root, scanRoot))) {
      const text = readFileSync(file, "utf8");
      for (const [index, line] of text.split("\n").entries()) {
        // A fresh regex per line: `pattern` may be sticky/global upstream.
        if (new RegExp(pattern.source).test(line)) {
          hits.push(`${relative(root, file)}:${index + 1}`);
        }
      }
    }
  }
  return hits;
}

describe("upstream branch references", () => {
  it("links to upstream through HEAD, never a branch name", () => {
    expect(scan(/aidlc-workflows\/(?:blob|tree|raw)\/(?!HEAD\/)/)).toEqual([]);
  });

  it("never names an upstream branch in a git ref", () => {
    expect(scan(/aidlc-workflows(?:\.git)?\s+refs\/heads\//)).toEqual([]);
    expect(scan(/--branch\s+(?:v2|main)\b/)).toEqual([]);
    // Prose too: a commit message or summary that names the branch is a claim
    // about which tree was synced, and it goes stale the same way.
    expect(scan(/awslabs\/aidlc-workflows\s+v\d/)).toEqual([]);
  });

  it("has the docs sync resolve the upstream branch from the remote", () => {
    const workflow = readFileSync(
      join(root, ".github", "workflows", "aidlc-workflows-docs-update.yml"),
      "utf8",
    );
    expect(workflow).toContain('git ls-remote --symref "$UPSTREAM_GIT_URL" HEAD');
    expect(workflow).toContain('--branch "$UPSTREAM_BRANCH"');
  });
});
