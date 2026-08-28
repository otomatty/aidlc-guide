import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertWithin,
  buildDiffReport,
  formatDiffReport,
  inlineCode,
  resolveUpstreamDocsRoot,
  walkContentFiles,
} from "../src/diff-report.ts";
import { workspaceRoot } from "./helpers.ts";

const fixtureUpstream = join(import.meta.dirname, "fixtures/upstream-docs");

/**
 * Directory symlinks work everywhere: Windows accepts a junction without
 * elevation, which lstat reports as a symlink just like a POSIX one.
 */
function dirSymlink(target: string, linkPath: string): void {
  symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : undefined);
}

/**
 * Windows rejects control characters in filenames outright, so the walker's
 * refusal can only be exercised where such a name can be created.
 */
const canControlCharName = ((): boolean => {
  try {
    const probe = mkdtempSync(join(tmpdir(), "od-ctrl-probe-"));
    writeFileSync(join(probe, "a\nb.md"), "x");
    return true;
  } catch {
    return false;
  }
})();

/**
 * FILE symlinks are the part Windows refuses without Developer Mode or
 * elevation, so that case only runs where the OS allows one to exist at all.
 */
const canSymlink = ((): boolean => {
  try {
    const probe = mkdtempSync(join(tmpdir(), "od-symlink-probe-"));
    writeFileSync(join(probe, "target"), "x");
    symlinkSync(join(probe, "target"), join(probe, "link"));
    return true;
  } catch {
    return false;
  }
})();

describe("diff-report (US-08 / FR-U6)", () => {
  it("walks nested markdown and skips dotfiles / gitkeep", () => {
    const root = mkdtempSync(join(tmpdir(), "od-walk-"));
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "a.md"), "a");
    writeFileSync(join(root, "nested", "b.md"), "b");
    writeFileSync(join(root, ".gitkeep"), "");
    writeFileSync(join(root, ".hidden.md"), "x");

    const files = walkContentFiles(root);
    expect([...files.keys()].sort()).toEqual(["a.md", "nested/b.md"]);
    expect(files.get("a.md")).toMatch(/^[a-f0-9]{64}$/);
  });

  // The upstream tree is an external repository and the sync copies whatever
  // this walker reports into a branch pushed with a write token. A
  // Markdown-named symlink at a secret (the runner checkout's .git/config) must
  // not become a document, and a directory symlink must not be descended into.
  it.skipIf(!canSymlink)("skips symlinks instead of following them", () => {
    const outside = mkdtempSync(join(tmpdir(), "od-walk-outside-"));
    writeFileSync(join(outside, "secret.txt"), "token");
    mkdirSync(join(outside, "elsewhere"), { recursive: true });
    writeFileSync(join(outside, "elsewhere", "c.md"), "c");

    const root = mkdtempSync(join(tmpdir(), "od-walk-symlink-"));
    writeFileSync(join(root, "a.md"), "a");
    symlinkSync(join(outside, "secret.txt"), join(root, "leak.md"));
    symlinkSync(join(outside, "elsewhere"), join(root, "escape"));

    expect([...walkContentFiles(root).keys()]).toEqual(["a.md"]);
  });

  // lstat only refuses a symlink as the final component, so a symlinked root or
  // ancestor still lets readdirSync walk a tree outside the checkout.
  it("refuses a symlinked content root instead of walking it", () => {
    const outside = mkdtempSync(join(tmpdir(), "od-root-outside-"));
    writeFileSync(join(outside, "secret.md"), "secret");

    const base = mkdtempSync(join(tmpdir(), "od-root-link-"));
    const link = join(base, "guide");
    dirSymlink(outside, link);

    expect(() => walkContentFiles(link)).toThrow(/must not be a symlink/);
  });

  // The ancestor case the root check alone cannot see: `guide` is the symlink
  // and the walked root `guide/en` is a real directory inside the external tree.
  it("refuses a content root reached through a symlinked ancestor", () => {
    const outside = mkdtempSync(join(tmpdir(), "od-anc2-outside-"));
    mkdirSync(join(outside, "en"), { recursive: true });
    writeFileSync(join(outside, "en", "secret.md"), "secret");

    const workspace = mkdtempSync(join(tmpdir(), "od-anc2-workspace-"));
    mkdirSync(join(workspace, "docs"), { recursive: true });
    dirSymlink(outside, join(workspace, "docs", "guide"));

    expect(() =>
      buildDiffReport({ workspaceRoot: workspace, upstreamRoot: fixtureUpstream }),
    ).toThrow(/escapes its tree/);
  });

  // A `realRoot + sep` prefix test doubles the separator when root IS the
  // filesystem root, rejecting everything inside it.
  it("accepts a path inside the filesystem root", () => {
    const inside = mkdtempSync(join(tmpdir(), "od-fsroot-"));
    expect(() => assertWithin(parse(inside).root, inside)).not.toThrow();
  });

  it("still refuses a sibling of the root and accepts a `..`-prefixed name", () => {
    const base = mkdtempSync(join(tmpdir(), "od-sibling-"));
    const root = join(base, "root");
    const sibling = join(base, "sibling");
    const dottedChild = join(root, "..foo");
    mkdirSync(dottedChild, { recursive: true });
    mkdirSync(sibling, { recursive: true });

    expect(() => assertWithin(root, sibling)).toThrow(/escapes its tree/);
    expect(() => assertWithin(root, dottedChild)).not.toThrow();
  });

  it("refuses an upstream docs root that escapes the checkout", () => {
    const outside = mkdtempSync(join(tmpdir(), "od-anc-outside-"));
    mkdirSync(join(outside, "guide"), { recursive: true });
    writeFileSync(join(outside, "guide", "secret.md"), "secret");

    const checkout = mkdtempSync(join(tmpdir(), "od-anc-checkout-"));
    dirSymlink(outside, join(checkout, "docs"));

    expect(() => resolveUpstreamDocsRoot(checkout)).toThrow(/escapes its tree/);
  });

  // Upstream filenames are attacker-controlled: Git allows a backtick, which
  // would close the code span and let the rest render as Markdown in the PR body.
  // A newline in a page name ends the Markdown list item, letting the rest of
  // the path render as a heading or checkbox in the PR body a human reviews.
  it.skipIf(!canControlCharName)("refuses a path with a control character", () => {
    const root = mkdtempSync(join(tmpdir(), "od-ctrl-"));
    writeFileSync(join(root, "ok.md"), "a");
    writeFileSync(join(root, "evil\n## Approved.md"), "b");

    expect(() => walkContentFiles(root)).toThrow(/control character/);
  });

  it("keeps an untrusted path inside its code span", () => {
    expect(inlineCode("guide/a.md")).toBe("`guide/a.md`");
    expect(inlineCode("guide/ev`il.md")).toBe("``guide/ev`il.md``");
    expect(inlineCode("`lead.md")).toBe("`` `lead.md ``");
    expect(inlineCode("a``b.md")).toBe("```a``b.md```");
  });

  it("resolves upstream docs root from checkout or docs/ itself", () => {
    expect(resolveUpstreamDocsRoot(fixtureUpstream)).toBe(join(fixtureUpstream, "docs"));
    expect(resolveUpstreamDocsRoot(join(fixtureUpstream, "docs"))).toBe(
      join(fixtureUpstream, "docs"),
    );
  });

  it("rejects upstream roots that lack guide/ and reference/", () => {
    const empty = mkdtempSync(join(tmpdir(), "od-empty-"));
    expect(() => resolveUpstreamDocsRoot(empty)).toThrow(/must contain guide\/ or reference\//);
  });

  it("rejects upstream roots where guide/reference exist as files", () => {
    const root = mkdtempSync(join(tmpdir(), "od-file-"));
    writeFileSync(join(root, "guide"), "not a directory");
    expect(() => resolveUpstreamDocsRoot(root)).toThrow(/must contain guide\/ or reference\//);

    const nested = mkdtempSync(join(tmpdir(), "od-file-nested-"));
    mkdirSync(join(nested, "docs"), { recursive: true });
    writeFileSync(join(nested, "docs", "reference"), "not a directory");
    expect(() => resolveUpstreamDocsRoot(nested)).toThrow(/must contain guide\/ or reference\//);
  });

  it("classifies added / modified / unchanged against the packaged snapshot", () => {
    // Seeded snapshot (not the repo tree — that now carries the full 2.6.x
    // upstream import, which would drown this fixture in `removed` entries).
    const snap = mkdtempSync(join(tmpdir(), "od-classify-"));
    mkdirSync(join(snap, "docs/guide/en"), { recursive: true });
    mkdirSync(join(snap, "docs/guide/ja"), { recursive: true });
    mkdirSync(join(snap, "docs/reference/en"), { recursive: true });
    const upstreamGettingStarted = join(fixtureUpstream, "docs/guide/getting-started.md");
    writeFileSync(
      join(snap, "docs/guide/en/getting-started.md"),
      readFileSync(upstreamGettingStarted),
    );
    writeFileSync(join(snap, "docs/guide/ja/getting-started.md"), "# はじめに\n");
    writeFileSync(join(snap, "docs/reference/en/scopes.md"), "# Scopes\n\nOld snapshot body.\n");
    writeFileSync(
      join(snap, "docs/official-docs.manifest.json"),
      JSON.stringify({
        sourceVersion: "fixture",
        source: "aidlc-workflows",
        capturedAt: "2026-08-06T00:00:00Z",
      }),
    );

    const report = buildDiffReport({
      workspaceRoot: snap,
      upstreamRoot: fixtureUpstream,
      now: new Date("2026-08-06T04:00:00.000Z"),
    });

    expect(report.snapshotManifest?.source).toBe("aidlc-workflows");
    expect(report.counts.added).toBeGreaterThanOrEqual(2);
    expect(report.counts.modified).toBe(1);
    expect(report.counts.unchanged).toBe(1);
    expect(report.counts.removed).toBe(0);

    const byPath = Object.fromEntries(report.entries.map((e) => [e.path, e]));
    expect(byPath["guide/getting-started.md"]?.status).toBe("unchanged");
    expect(byPath["guide/getting-started.md"]?.jaPresent).toBe(true);
    expect(byPath["reference/scopes.md"]?.status).toBe("modified");
    expect(byPath["guide/00-introduction.md"]?.status).toBe("added");
    expect(byPath["guide/00-introduction.md"]?.jaPresent).toBe(false);
    expect(byPath["guide/agents/README.md"]?.status).toBe("added");
  });

  it("flags removed snapshot pages and formats translate-PR markdown", () => {
    const snap = mkdtempSync(join(tmpdir(), "od-snap-"));
    const up = mkdtempSync(join(tmpdir(), "od-up-"));
    mkdirSync(join(snap, "docs/guide/en"), { recursive: true });
    mkdirSync(join(snap, "docs/guide/ja"), { recursive: true });
    mkdirSync(join(snap, "docs/reference/en"), { recursive: true });
    mkdirSync(join(up, "docs/guide"), { recursive: true });

    writeFileSync(join(snap, "docs/guide/en/kept.md"), "same");
    writeFileSync(join(snap, "docs/guide/en/gone.md"), "old");
    writeFileSync(join(snap, "docs/guide/ja/gone.md"), "訳");
    writeFileSync(join(snap, "docs/reference/en/only-snap.md"), "x");
    writeFileSync(
      join(snap, "docs/official-docs.manifest.json"),
      JSON.stringify({
        sourceVersion: "test",
        source: "aidlc-workflows",
        capturedAt: "2026-08-06T00:00:00Z",
      }),
    );
    writeFileSync(join(up, "docs/guide/kept.md"), "same");
    writeFileSync(join(up, "docs/guide/new.md"), "fresh");

    const report = buildDiffReport({
      workspaceRoot: snap,
      upstreamRoot: up,
      now: new Date("2026-08-06T12:00:00.000Z"),
    });

    expect(report.counts).toEqual({
      added: 1,
      removed: 2,
      modified: 0,
      unchanged: 1,
    });

    const md = formatDiffReport(report);
    expect(md).toContain("# Official docs diff report");
    expect(md).toContain("## Added (in upstream, not in snapshot en)");
    expect(md).toContain("`guide/new.md`");
    expect(md).toContain("## Removed (in snapshot en, not in upstream)");
    expect(md).toContain("`guide/gone.md` — ja present (orphan translation?)");
    expect(md).toContain("`reference/only-snap.md`");
    expect(md).toContain("## Translate-PR checklist");
    expect(md).toContain("sourceVersion=`test`");
    expect(md).not.toMatch(/stub/i);
  });

  it("ships the CLI entry that is no longer a stub", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const cli = join(workspaceRoot, "scripts/official-docs-diff.ts");
    expect(existsSync(cli)).toBe(true);
    const body = readFileSync(cli, "utf8");
    expect(body).toContain("buildDiffReport");
    expect(body).not.toContain("status: stub");
  });

  it("CLI usage-errors on missing option values and invalid upstream", async () => {
    const { spawnSync } = await import("node:child_process");
    const cli = join(workspaceRoot, "scripts/official-docs-diff.ts");
    const run = (args: string[]) =>
      spawnSync("bun", [cli, ...args], {
        cwd: workspaceRoot,
        encoding: "utf8",
      });

    for (const args of [
      ["--upstream"],
      ["--upstream", "--out", "x.md"],
      ["--upstream", fixtureUpstream, "--out"],
      ["--upstream", fixtureUpstream, "--out", "--now"],
      ["--upstream", fixtureUpstream, "--workspace"],
      ["--upstream", fixtureUpstream, "--now"],
    ]) {
      const result = run(args);
      expect(result.status, `expected usage fail for ${args.join(" ")}`).toBe(1);
      expect(result.stderr).toMatch(/Usage:/);
    }

    const badUp = mkdtempSync(join(tmpdir(), "od-cli-bad-"));
    const bad = run(["--upstream", badUp]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/must contain guide\/ or reference\//);
  }, 15_000);
});
