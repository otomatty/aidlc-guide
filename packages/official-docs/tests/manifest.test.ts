import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readManifest } from "../src/manifest.ts";
import { expectError, expectOk, workspaceRoot } from "./helpers.ts";

describe("readManifest", () => {
  it("reads the workspace official-docs manifest", async () => {
    const manifest = expectOk(await readManifest(workspaceRoot));
    expect(manifest.sourceVersion.length).toBeGreaterThan(0);
    expect(manifest.source).toBe("aidlc-workflows");
    expect(manifest.capturedAt.length).toBeGreaterThan(0);
  });

  it("returns empty_content when the manifest file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "od-manifest-missing-"));
    await mkdir(join(root, "docs"), { recursive: true });
    expectError(await readManifest(root), "empty_content");
  });

  it("returns empty_content when required fields are blank", async () => {
    const root = await mkdtemp(join(tmpdir(), "od-manifest-blank-"));
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "docs", "official-docs.manifest.json"),
      JSON.stringify({ sourceVersion: "", source: "x", capturedAt: "y" }),
    );
    expectError(await readManifest(root), "empty_content");
  });

  it("returns empty_content when JSON is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "od-manifest-bad-"));
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "official-docs.manifest.json"), "{not-json");
    expectError(await readManifest(root), "empty_content");
  });
});
