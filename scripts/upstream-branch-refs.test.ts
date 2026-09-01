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
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_DOCS_SECTIONS } from "../packages/shared-types/src/index.ts";

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

/**
 * The mirrored documentation trees, `docs/<section>/{en,ja}`. Derived from the
 * section list rather than spelled out, so a section added there is covered
 * without touching this file. `en` is a verbatim copy of upstream and `ja`
 * translates it, so neither carries this repository's own words.
 */
function isMirroredDoc(rel: string): boolean {
  return OFFICIAL_DOCS_SECTIONS.some((section) => rel.startsWith(`docs${sep}${section}${sep}`));
}

function scan(pattern: RegExp, options?: { skip?: (rel: string) => boolean }): string[] {
  const hits: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    for (const file of walk(join(root, scanRoot))) {
      if (options?.skip?.(relative(root, file)) === true) continue;
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
    // The mirrored docs are exempt from THIS assertion only. Upstream's own
    // install steps tell a reader to `git clone --branch main`, and
    // `docs/<section>/en` copies them verbatim -- an edit here is undone by the
    // next `sync-official-docs.ts` run, and the `ja` page has to say what the
    // page it translates says. What this line actually guards is a branch name
    // baked into a git command THIS repository runs, and those live under
    // `scripts/`, `packages/` and `.github/workflows/`, none of them exempt.
    expect(scan(/--branch\s+(?:v2|main)\b/, { skip: isMirroredDoc })).toEqual([]);
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
