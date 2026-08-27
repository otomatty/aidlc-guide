import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareWorkflowsVersion,
  isSnoozedForPin,
  parseAidlcVersionSource,
  parsePinnedManifest,
  readPinnedVersion,
  readWorkspaceAidlcVersion,
  shouldPromptWorkflowsUpdate,
} from "../src/workflows-version.ts";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

describe("parseAidlcVersionSource", () => {
  it("reads the exported constant", () => {
    expect(parseAidlcVersionSource('export const AIDLC_VERSION = "2.6.99";\n')).toBe("2.6.99");
    expect(parseAidlcVersionSource("export const AIDLC_VERSION = '2.5.0';")).toBe("2.5.0");
  });

  it("returns null when the constant is missing or not a semver", () => {
    expect(parseAidlcVersionSource("export const OTHER = '2.6.99';")).toBeNull();
    expect(parseAidlcVersionSource('export const AIDLC_VERSION = "dev";')).toBeNull();
  });
});

describe("parsePinnedManifest / readPinnedVersion", () => {
  it("reads sourceVersion from the official-docs manifest", () => {
    expect(
      parsePinnedManifest(
        JSON.stringify({
          sourceVersion: "2.6.99",
          source: "aidlc-workflows",
          capturedAt: "2026-08-26T02:58:44Z",
        }),
      ),
    ).toBe("2.6.99");
    expect(parsePinnedManifest("{not-json")).toBeNull();
    expect(parsePinnedManifest(JSON.stringify({ source: "x" }))).toBeNull();
  });

  it("reads the packaged docs tree", () => {
    const docsRoot = tempDir("aidlc-pin-");
    mkdirSync(join(docsRoot, "docs"), { recursive: true });
    writeFileSync(
      join(docsRoot, "docs", "official-docs.manifest.json"),
      JSON.stringify({
        sourceVersion: "2.6.99",
        source: "aidlc-workflows",
        capturedAt: "2026-08-01T00:00:00Z",
      }),
    );
    expect(readPinnedVersion(docsRoot)).toBe("2.6.99");
  });

  it("returns null when the manifest is missing", () => {
    expect(readPinnedVersion(tempDir("aidlc-pin-missing-"))).toBeNull();
  });
});

describe("readWorkspaceAidlcVersion", () => {
  it("reports the oldest installed harness version, not the first file found", () => {
    const root = tempDir("aidlc-ws-ver-");
    mkdirSync(join(root, ".claude", "tools"), { recursive: true });
    writeFileSync(
      join(root, ".claude", "tools", "aidlc-version.ts"),
      'export const AIDLC_VERSION = "2.5.0";\n',
    );
    expect(readWorkspaceAidlcVersion(root)).toEqual({
      version: "2.5.0",
      sourcePath: join(root, ".claude", "tools", "aidlc-version.ts"),
      raw: 'export const AIDLC_VERSION = "2.5.0";\n',
    });

    mkdirSync(join(root, ".cursor", "tools"), { recursive: true });
    writeFileSync(
      join(root, ".cursor", "tools", "aidlc-version.ts"),
      'export const AIDLC_VERSION = "2.6.99";\n',
    );
    const read = readWorkspaceAidlcVersion(root);
    expect(read.version).toBe("2.5.0");
    expect(read.sourcePath).toBe(join(root, ".claude", "tools", "aidlc-version.ts"));
  });

  it("returns unparseable when any installed version file is not a semver", () => {
    const root = tempDir("aidlc-ws-mixed-bad-");
    mkdirSync(join(root, ".cursor", "tools"), { recursive: true });
    mkdirSync(join(root, ".claude", "tools"), { recursive: true });
    writeFileSync(
      join(root, ".cursor", "tools", "aidlc-version.ts"),
      'export const AIDLC_VERSION = "2.6.99";\n',
    );
    writeFileSync(
      join(root, ".claude", "tools", "aidlc-version.ts"),
      "export const AIDLC_VERSION = 'next';\n",
    );
    const read = readWorkspaceAidlcVersion(root);
    expect(read.version).toBeNull();
    expect(read.sourcePath).toBe(join(root, ".claude", "tools", "aidlc-version.ts"));
  });

  it("returns unparseable when the file exists but is not a semver", () => {
    const root = tempDir("aidlc-ws-bad-");
    mkdirSync(join(root, ".cursor", "tools"), { recursive: true });
    writeFileSync(
      join(root, ".cursor", "tools", "aidlc-version.ts"),
      "export const AIDLC_VERSION = 'next';\n",
    );
    const read = readWorkspaceAidlcVersion(root);
    expect(read.version).toBeNull();
    expect(read.sourcePath).not.toBeNull();
    expect(read.raw).toContain("next");
  });

  it("returns no source when none of the version files exist", () => {
    const root = tempDir("aidlc-ws-none-");
    expect(readWorkspaceAidlcVersion(root)).toEqual({
      version: null,
      sourcePath: null,
      raw: null,
    });
  });
});

describe("compareWorkflowsVersion / shouldPromptWorkflowsUpdate", () => {
  it("flags only a workspace older than the Guide pin", () => {
    expect(compareWorkflowsVersion("2.5.0", "2.6.99")).toEqual({
      kind: "older",
      workspace: "2.5.0",
      pin: "2.6.99",
    });
    expect(compareWorkflowsVersion("2.6.99", "2.6.99").kind).toBe("current-or-newer");
    expect(compareWorkflowsVersion("2.7.0", "2.6.99").kind).toBe("current-or-newer");
  });

  it("does not prompt on current, newer, unparseable, missing, or snoozed", () => {
    expect(
      shouldPromptWorkflowsUpdate({ kind: "older", workspace: "2.5.0", pin: "2.6.99" }, false),
    ).toBe(true);
    expect(
      shouldPromptWorkflowsUpdate({ kind: "older", workspace: "2.5.0", pin: "2.6.99" }, true),
    ).toBe(false);
    expect(
      shouldPromptWorkflowsUpdate(
        { kind: "current-or-newer", workspace: "2.6.99", pin: "2.6.99" },
        false,
      ),
    ).toBe(false);
    expect(
      shouldPromptWorkflowsUpdate({ kind: "unparseable", raw: "dev", pin: "2.6.99" }, false),
    ).toBe(false);
    expect(shouldPromptWorkflowsUpdate({ kind: "missing", pin: "2.6.99" }, false)).toBe(false);
  });

  it("treats a missing pin as unparseable rather than an update offer", () => {
    expect(compareWorkflowsVersion("2.5.0", null).kind).toBe("unparseable");
    expect(compareWorkflowsVersion(null, "2.6.99")).toEqual({ kind: "missing", pin: "2.6.99" });
  });

  it("snoozes only the pin that was dismissed, not a later Guide pin", () => {
    expect(isSnoozedForPin("2.6.99", "2.6.99")).toBe(true);
    expect(isSnoozedForPin("2.6.99", "2.7.0")).toBe(false);
    expect(isSnoozedForPin(true, "2.6.99")).toBe(false);
    expect(isSnoozedForPin(undefined, "2.6.99")).toBe(false);
  });
});
