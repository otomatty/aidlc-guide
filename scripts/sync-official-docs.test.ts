import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatManifest,
  jaDrift,
  LOCAL_ONLY_DOC_PATHS,
  parseAidlcVersion,
  planSync,
  readPinnedManifest,
  runCli,
  unportablePaths,
} from "./sync-official-docs.ts";

function write(root: string, rel: string, body: string): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body);
}

/** Upstream checkout + snapshot workspace covering every diff status at once. */
function seed(): { upstream: string; workspace: string } {
  const base = mkdtempSync(join(tmpdir(), "sync-official-docs-"));
  const upstream = join(base, "upstream");
  const workspace = join(base, "workspace");

  write(
    upstream,
    "dist/claude/.claude/tools/aidlc-version.ts",
    'export const AIDLC_VERSION = "9.9.9";\n',
  );
  write(upstream, "docs/guide/00-introduction.md", "# Introduction\n\nNew upstream body.\n");
  write(upstream, "docs/guide/agents/product.md", "# Product agent\n");
  write(upstream, "docs/reference/00-overview.md", "# Overview\n");

  write(
    workspace,
    "docs/official-docs.manifest.json",
    `${JSON.stringify(
      { sourceVersion: "9.9.8", source: "aidlc-workflows", capturedAt: "2026-01-01T00:00:00Z" },
      null,
      2,
    )}\n`,
  );
  write(workspace, "docs/guide/en/00-introduction.md", "# Introduction\n\nStale body.\n");
  write(workspace, "docs/guide/en/gone.md", "# Dropped upstream\n");
  write(workspace, "docs/guide/en/getting-started.md", "# Getting started\n\n## Approval gates\n");
  write(workspace, "docs/reference/en/00-overview.md", "# Overview\n");
  write(workspace, "docs/guide/ja/00-introduction.md", "# はじめに\n");
  write(workspace, "docs/guide/ja/gone.md", "# 削除済み\n");

  return { upstream, workspace };
}

/**
 * Every unportable name is one Windows cannot carry, so the end-to-end case only
 * runs where such a file can exist. The write must be read back: on NTFS
 * `a:b.md` silently creates file `a` with an alternate data stream, so it
 * succeeds without ever producing that name.
 */
const canUnportableName = ((): boolean => {
  try {
    const probe = mkdtempSync(join(tmpdir(), "sync-unportable-probe-"));
    writeFileSync(join(probe, "a:b.md"), "x");
    return readdirSync(probe).includes("a:b.md");
  } catch {
    return false;
  }
})();

describe("planSync", () => {
  it("writes added and modified pages and drops removed ones with their ja orphan", () => {
    const plan = planSync([
      { path: "guide/new.md", status: "added", jaPresent: false },
      { path: "guide/changed.md", status: "modified", jaPresent: true },
      { path: "guide/gone.md", status: "removed", jaPresent: true },
      { path: "reference/gone-untranslated.md", status: "removed", jaPresent: false },
      { path: "guide/same.md", status: "unchanged", jaPresent: true },
    ]);

    expect(plan.writes).toEqual(["guide/new.md", "guide/changed.md"]);
    expect(plan.enDeletes).toEqual(["guide/gone.md", "reference/gone-untranslated.md"]);
    expect(plan.jaDeletes).toEqual(["guide/gone.md"]);
    expect(plan.preserved).toEqual([]);
  });

  it("keeps a repo-owned page that upstream does not have", () => {
    const localOnly = [...LOCAL_ONLY_DOC_PATHS];
    expect(localOnly.length).toBeGreaterThan(0);
    const first = localOnly[0] as string;

    const plan = planSync([{ path: first, status: "removed", jaPresent: true }]);

    expect(plan.preserved).toEqual([first]);
    expect(plan.enDeletes).toEqual([]);
    expect(plan.jaDeletes).toEqual([]);
  });

  // Upstream publishing a page at one of these names must not overwrite ours:
  // stage-map.ts links to anchors that exist only in the local copy.
  it("keeps a repo-owned page even when upstream publishes one at that path", () => {
    const first = [...LOCAL_ONLY_DOC_PATHS][0] as string;

    for (const status of ["added", "modified"] as const) {
      const plan = planSync([{ path: first, status, jaPresent: false }]);
      expect(plan.writes).toEqual([]);
      expect(plan.preserved).toEqual([first]);
    }
  });
});

describe("jaDrift", () => {
  it("reports changed, removed and newly added ja files", () => {
    const before = new Map([
      ["guide/a.md", "hash-a"],
      ["guide/b.md", "hash-b"],
    ]);
    const after = new Map([
      ["guide/a.md", "hash-a-edited"],
      ["guide/c.md", "hash-c"],
    ]);

    expect(jaDrift(before, after)).toEqual(["guide/a.md", "guide/b.md", "guide/c.md"]);
  });

  it("reports nothing when the tree is untouched", () => {
    const tree = new Map([["guide/a.md", "hash-a"]]);
    expect(jaDrift(tree, new Map(tree))).toEqual([]);
  });
});

describe("parseAidlcVersion", () => {
  it("reads the exported constant", () => {
    expect(parseAidlcVersion('export const AIDLC_VERSION = "2.6.99";')).toBe("2.6.99");
  });

  it("returns null when the constant is absent", () => {
    expect(parseAidlcVersion("export const OTHER = 1;")).toBeNull();
  });

  // The version reaches a filesystem path, so a version carrying separators
  // must not be accepted at all -- it would let the report escape docs/reviews.
  it("rejects a version that is not a plain semver", () => {
    for (const bad of [
      "2.6.1/../../docs/guide/ja/getting-started",
      "../../etc/passwd",
      "2.6",
      "",
      "v2.6.1",
    ]) {
      expect(parseAidlcVersion(`export const AIDLC_VERSION = "${bad}";`)).toBeNull();
    }
    for (const good of ["2.6.119", "2.6.119-rc.1", "2.7.0+build.5", "2.7.0-rc.1+build.5"]) {
      expect(parseAidlcVersion(`export const AIDLC_VERSION = "${good}";`)).toBe(good);
    }
  });
});

describe("formatManifest", () => {
  it("round-trips through the manifest reader", () => {
    const root = mkdtempSync(join(tmpdir(), "sync-manifest-"));
    write(
      root,
      "docs/official-docs.manifest.json",
      formatManifest({
        sourceVersion: "2.7.0",
        upstreamSha: "a".repeat(40),
        capturedAt: "2026-08-27T00:00:00Z",
      }),
    );

    expect(readPinnedManifest(root)).toEqual({
      sourceVersion: "2.7.0",
      source: "aidlc-workflows",
      capturedAt: "2026-08-27T00:00:00Z",
      upstreamSha: "a".repeat(40),
    });
  });

  it("reads a manifest pinned before upstreamSha existed", () => {
    const root = mkdtempSync(join(tmpdir(), "sync-manifest-legacy-"));
    write(
      root,
      "docs/official-docs.manifest.json",
      '{"sourceVersion":"2.6.99","source":"aidlc-workflows","capturedAt":"2026-08-26T02:58:44Z"}',
    );

    expect(readPinnedManifest(root)?.upstreamSha).toBeUndefined();
  });
});

describe("unportablePaths", () => {
  it("passes paths every supported OS can carry", () => {
    expect(unportablePaths(["guide/00-intro.md", "reference/04-stages/construction.md"])).toEqual(
      [],
    );
    // Only whole reserved segments count -- `console.md` is an ordinary page.
    expect(unportablePaths(["guide/console.md", "guide/a b.md"])).toEqual([]);
  });

  it("rejects characters and names Windows cannot check out", () => {
    expect(unportablePaths(["guide/a:b.md"])).toEqual(["guide/a:b.md"]);
    expect(unportablePaths(["guide/a\\b.md"])).toEqual(["guide/a\\b.md"]);
    expect(unportablePaths(["guide/q?.md", "guide/s*.md", "guide/p|.md"])).toHaveLength(3);
    expect(unportablePaths(["guide/CON.md", "guide/com1", "guide/lpt9.txt"])).toHaveLength(3);
    expect(unportablePaths(["guide/trailing.", "guide/trailing "])).toHaveLength(2);
  });

  it("rejects two pages that differ only in case", () => {
    expect(unportablePaths(["guide/Read.md", "guide/read.md"])).toEqual([
      "guide/Read.md vs guide/read.md",
    ]);
  });
});

describe("runCli", () => {
  it("mirrors en, deletes ja orphans, and re-pins the manifest", () => {
    const { upstream, workspace } = seed();
    const sha = "b".repeat(40);

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      sha,
      "--workspace",
      workspace,
      "--now",
      "2026-08-27T10:00:00.000Z",
      "--pr-body",
      join(workspace, "pr-body.md"),
    ]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    // en mirrors upstream: modified overwritten, added created, removed gone.
    expect(readFileSync(join(workspace, "docs/guide/en/00-introduction.md"), "utf8")).toBe(
      "# Introduction\n\nNew upstream body.\n",
    );
    expect(existsSync(join(workspace, "docs/guide/en/agents/product.md"))).toBe(true);
    expect(existsSync(join(workspace, "docs/guide/en/gone.md"))).toBe(false);

    // ja: the orphan goes with its English original, everything else survives.
    expect(existsSync(join(workspace, "docs/guide/ja/gone.md"))).toBe(false);
    expect(readFileSync(join(workspace, "docs/guide/ja/00-introduction.md"), "utf8")).toBe(
      "# はじめに\n",
    );

    // A page this repo owns is not upstream and must not be mirrored away.
    expect(existsSync(join(workspace, "docs/guide/en/getting-started.md"))).toBe(true);

    expect(readPinnedManifest(workspace)).toEqual({
      sourceVersion: "9.9.9",
      source: "aidlc-workflows",
      capturedAt: "2026-08-27T10:00:00Z",
      upstreamSha: sha,
    });

    const report = readFileSync(
      join(workspace, "docs/reviews/official-docs-diff-9.9.9.md"),
      "utf8",
    );
    expect(report).toContain("# Official docs diff report");
    // The report is built pre-mirror, so it records the old pin, not the new one.
    expect(report).toContain("sourceVersion=`9.9.8`");

    const prBody = readFileSync(join(workspace, "pr-body.md"), "utf8");
    expect(prBody).toContain("| AIDLC_VERSION | 9.9.8 | 9.9.9 |");
    expect(prBody).toContain("`guide/getting-started.md`");

    expect(result.stdout).toContain("version=9.9.9");
    expect(result.stdout).toContain(`sha=${sha}`);
    expect(result.stdout).toContain("previous_sha=\n");
  });

  // Upstream can flip a name between a directory and a file. Writing before the
  // stale entry is cleared dies with EISDIR/ENOTDIR and stalls the sync.
  it("mirrors a path that swapped between a directory and a file", () => {
    const base = mkdtempSync(join(tmpdir(), "sync-flip-"));
    const upstream = join(base, "upstream");
    const workspace = join(base, "workspace");

    write(
      upstream,
      "dist/claude/.claude/tools/aidlc-version.ts",
      'export const AIDLC_VERSION = "9.9.9";\n',
    );
    // Upstream: `topic` is now a file, `other` is now a directory.
    write(upstream, "docs/guide/topic", "# Topic\n");
    write(upstream, "docs/guide/other/new.md", "# New\n");

    write(
      workspace,
      "docs/official-docs.manifest.json",
      '{"sourceVersion":"9.9.8","source":"aidlc-workflows","capturedAt":"2026-01-01T00:00:00Z"}',
    );
    // Snapshot: `topic` is a directory, `other` is a file — both the wrong type.
    write(workspace, "docs/guide/en/topic/old.md", "# Old\n");
    write(workspace, "docs/guide/en/other", "# Other\n");

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      "1".repeat(40),
      "--workspace",
      workspace,
    ]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(join(workspace, "docs/guide/en/topic"), "utf8")).toBe("# Topic\n");
    expect(readFileSync(join(workspace, "docs/guide/en/other/new.md"), "utf8")).toBe("# New\n");
  });

  it.skipIf(!canUnportableName)("refuses an unportable upstream path before mirroring", () => {
    const { upstream, workspace } = seed();
    write(upstream, "docs/guide/a:b.md", "# Colon\n");

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      "2".repeat(40),
      "--workspace",
      workspace,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not portable");
    expect(existsSync(join(workspace, "docs/guide/en/gone.md"))).toBe(true);
    expect(readPinnedManifest(workspace)?.sourceVersion).toBe("9.9.8");
  });

  it("fails when the upstream checkout has no version file", () => {
    const { workspace } = seed();
    const bare = mkdtempSync(join(tmpdir(), "sync-bare-upstream-"));
    write(bare, "docs/guide/00-introduction.md", "# Introduction\n");

    const result = runCli([
      "--upstream",
      bare,
      "--upstream-sha",
      "c".repeat(40),
      "--workspace",
      workspace,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("aidlc-version.ts");
    // The snapshot must be untouched when the run refuses.
    expect(existsSync(join(workspace, "docs/guide/en/gone.md"))).toBe(true);
  });

  it("refuses a valueless --pr-body without touching the snapshot", () => {
    const { upstream, workspace } = seed();

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      "d".repeat(40),
      "--workspace",
      workspace,
      "--pr-body",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
    // The flag is read before the first write, so nothing is half-applied.
    expect(existsSync(join(workspace, "docs/guide/en/gone.md"))).toBe(true);
    expect(readPinnedManifest(workspace)?.sourceVersion).toBe("9.9.8");
    expect(existsSync(join(workspace, "docs/reviews/official-docs-diff-9.9.9.md"))).toBe(false);
  });

  it("refuses an undeliverable --pr-body destination before mirroring", () => {
    const { upstream, workspace } = seed();
    // Parent is a file, so the destination directory cannot be created.
    write(workspace, "blocked", "not a directory");

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      "e".repeat(40),
      "--workspace",
      workspace,
      "--pr-body",
      join(workspace, "blocked", "pr-body.md"),
    ]);

    expect(result.status).toBe(1);
    expect(existsSync(join(workspace, "docs/guide/en/gone.md"))).toBe(true);
    expect(readPinnedManifest(workspace)?.sourceVersion).toBe("9.9.8");
  });

  it("refuses a --pr-body destination that is a directory", () => {
    const { upstream, workspace } = seed();
    mkdirSync(join(workspace, "body-dir"), { recursive: true });

    const result = runCli([
      "--upstream",
      upstream,
      "--upstream-sha",
      "f".repeat(40),
      "--workspace",
      workspace,
      "--pr-body",
      join(workspace, "body-dir"),
    ]);

    expect(result.status).toBe(1);
    expect(existsSync(join(workspace, "docs/guide/en/gone.md"))).toBe(true);
    expect(readPinnedManifest(workspace)?.sourceVersion).toBe("9.9.8");
    expect(existsSync(join(workspace, "docs/reviews/official-docs-diff-9.9.9.md"))).toBe(false);
  });

  it("refuses without the required flags", () => {
    expect(runCli(["--upstream", "somewhere"]).status).toBe(1);
    expect(runCli([]).stderr).toContain("Usage:");
  });
});
