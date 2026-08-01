import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOfficialDocsRoot } from "../src/official-docs-root.ts";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveOfficialDocsRoot", () => {
  it("uses packaged media when the manifest is present", () => {
    const extensionPath = mkdtempSync(join(tmpdir(), "aidlc-ext-"));
    temps.push(extensionPath);
    const docs = join(extensionPath, "media", "official-docs", "docs");
    mkdirSync(docs, { recursive: true });
    writeFileSync(
      join(docs, "official-docs.manifest.json"),
      JSON.stringify({
        sourceVersion: "t",
        source: "aidlc-workflows",
        capturedAt: "2026-08-01T00:00:00Z",
      }),
    );
    const workspaceRoot = join(extensionPath, "workspace");
    expect(resolveOfficialDocsRoot(extensionPath, workspaceRoot)).toBe(
      join(extensionPath, "media", "official-docs"),
    );
  });

  it("falls back to the workspace when the snapshot is missing", () => {
    const extensionPath = mkdtempSync(join(tmpdir(), "aidlc-ext-"));
    temps.push(extensionPath);
    const workspaceRoot = join(extensionPath, "workspace");
    expect(resolveOfficialDocsRoot(extensionPath, workspaceRoot)).toBe(workspaceRoot);
  });
});
