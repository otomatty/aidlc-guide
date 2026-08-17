import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDiffReport,
  formatDiffReport,
  resolveUpstreamDocsRoot,
  walkContentFiles,
} from "../src/diff-report.ts";
import { workspaceRoot } from "./helpers.ts";

const fixtureUpstream = join(import.meta.dirname, "fixtures/upstream-docs");

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
    const report = buildDiffReport({
      workspaceRoot,
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
