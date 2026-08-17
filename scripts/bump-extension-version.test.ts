import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyManifestBump,
  applyManifestVersion,
  bumpVersion,
  decideExtensionBump,
  formatDecideOutput,
  parseExtensionVersion,
  resolveReleaseLabels,
  runCli,
} from "./bump-extension-version.ts";

describe("parseExtensionVersion", () => {
  it("reads dotted triples and strips build metadata", () => {
    expect(parseExtensionVersion("0.2.0")).toEqual({
      major: 0,
      minor: 2,
      patch: 0,
      prerelease: "",
    });
    expect(parseExtensionVersion("1.0.0-rc.1")?.prerelease).toBe("rc.1");
    expect(parseExtensionVersion("1.0.0+build.9")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "",
    });
    expect(parseExtensionVersion("v0.2.0")).toBeNull();
    expect(parseExtensionVersion("dev")).toBeNull();
  });
});

describe("resolveReleaseLabels", () => {
  it("ignores unrelated labels and dedupes", () => {
    expect(resolveReleaseLabels(["docs", "release:patch", "release:patch"])).toEqual({
      kind: "level",
      level: "patch",
    });
    expect(resolveReleaseLabels(["enhancement"])).toEqual({ kind: "none" });
    expect(resolveReleaseLabels(["constructor", "__proto__", "toString"])).toEqual({
      kind: "none",
    });
  });

  it("refuses two release labels rather than guessing", () => {
    expect(resolveReleaseLabels(["release:minor", "release:patch"])).toEqual({
      kind: "conflict",
      labels: ["release:minor", "release:patch"],
    });
  });
});

describe("bumpVersion", () => {
  it("increments a stable version", () => {
    expect(bumpVersion("0.2.0", "patch")).toBe("0.2.1");
    expect(bumpVersion("0.2.0", "minor")).toBe("0.3.0");
    expect(bumpVersion("0.2.0", "major")).toBe("1.0.0");
  });

  it("graduates a prerelease of the version that increment would produce", () => {
    expect(bumpVersion("0.2.0-rc.1", "patch")).toBe("0.2.0");
    expect(bumpVersion("0.2.0-rc.1", "minor")).toBe("0.2.0");
    expect(bumpVersion("0.2.0-rc.1", "major")).toBe("1.0.0");
    expect(bumpVersion("1.0.0-rc.1", "major")).toBe("1.0.0");
    expect(bumpVersion("1.0.1-rc.1", "minor")).toBe("1.1.0");
  });

  it("rejects an unreadable version", () => {
    expect(() => bumpVersion("dev", "patch")).toThrow(/invalid extension version/);
  });
});

describe("decideExtensionBump", () => {
  it("skips a merge that did not ask for a release", () => {
    expect(decideExtensionBump({ labels: ["docs"], current: "0.2.0", previous: "0.2.0" })).toEqual({
      action: "skip",
      reason: "no-label",
    });
  });

  it("skips when the PR already changed the version, even with a label", () => {
    expect(
      decideExtensionBump({
        labels: ["release:patch"],
        current: "0.2.1",
        previous: "0.2.0",
      }),
    ).toEqual({
      action: "skip",
      reason: "already-bumped",
      previous: "0.2.0",
      current: "0.2.1",
    });
  });

  it("bumps from latest-main later; decide only records the level", () => {
    expect(
      decideExtensionBump({
        labels: ["release:minor"],
        current: "0.2.0",
        previous: "0.2.0",
      }),
    ).toEqual({ action: "bump", level: "minor", from: "0.2.0" });
  });

  it("fails closed on a conflict or a garbage current version", () => {
    expect(
      decideExtensionBump({
        labels: ["release:major", "release:patch"],
        current: "0.2.0",
        previous: "0.2.0",
      }),
    ).toEqual({
      action: "conflict",
      labels: ["release:major", "release:patch"],
    });
    expect(
      decideExtensionBump({ labels: ["release:patch"], current: "dev", previous: "dev" }),
    ).toEqual({ action: "invalid-version", version: "dev" });
  });
});

describe("formatDecideOutput", () => {
  it("emits GitHub Actions key=value lines", () => {
    expect(formatDecideOutput({ action: "skip", reason: "no-label" })).toEqual([
      "action=skip",
      "reason=no-label",
    ]);
    expect(formatDecideOutput({ action: "bump", level: "patch", from: "0.2.0" })).toEqual([
      "action=bump",
      "level=patch",
      "from=0.2.0",
    ]);
    expect(
      formatDecideOutput({
        action: "skip",
        reason: "already-bumped",
        previous: "0.2.0",
        current: "0.2.1",
      }),
    ).toEqual(["action=skip", "reason=already-bumped", "previous=0.2.0", "current=0.2.1"]);
  });
});

describe("applyManifestVersion", () => {
  it("rewrites only the version and keeps a trailing newline", () => {
    const next = applyManifestVersion(
      '{\n  "name": "aidlc-guide",\n  "version": "0.2.0"\n}\n',
      "0.2.1",
    );
    expect(JSON.parse(next)).toEqual({ name: "aidlc-guide", version: "0.2.1" });
    expect(next.endsWith("\n")).toBe(true);
  });

  it("rejects a non-object manifest", () => {
    expect(() => applyManifestVersion("[]", "0.2.1")).toThrow(/JSON object/);
  });
});

describe("applyManifestBump", () => {
  it("bumps from the file's current version so back-to-back merges do not collide", () => {
    const json = '{\n  "version": "0.2.1"\n}\n';
    const applied = applyManifestBump(json, { level: "patch" });
    expect(applied.next).toBe("0.2.2");
    expect(JSON.parse(applied.text).version).toBe("0.2.2");
  });

  it("accepts an explicit version for a manual write", () => {
    const applied = applyManifestBump('{"version":"0.2.0"}', { version: "0.3.0" });
    expect(applied.next).toBe("0.3.0");
  });

  it("rejects a missing version field", () => {
    expect(() => applyManifestBump("{}", { level: "patch" })).toThrow(/missing a string version/);
  });
});

describe("runCli", () => {
  it("prints decide output and fails closed on conflict", () => {
    const ok = runCli([
      "decide",
      "--labels",
      "release:patch,docs",
      "--current",
      "0.2.0",
      "--previous",
      "0.2.0",
    ]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toBe("action=bump\nlevel=patch\nfrom=0.2.0\n");

    const conflict = runCli([
      "decide",
      "--labels",
      "release:patch,release:minor",
      "--current",
      "0.2.0",
      "--previous",
      "0.2.0",
    ]);
    expect(conflict.status).toBe(1);
    expect(conflict.stdout).toContain("action=conflict");
  });

  it("writes the manifest on apply --level", () => {
    const dir = mkdtempSync(join(tmpdir(), "ext-bump-"));
    const manifest = join(dir, "package.json");
    writeFileSync(manifest, '{\n  "name": "aidlc-guide",\n  "version": "0.2.0"\n}\n');
    const result = runCli(["apply", "--manifest", manifest, "--level", "minor"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("0.3.0\n");
    expect(JSON.parse(readFileSync(manifest, "utf8")).version).toBe("0.3.0");
  });

  it("usage-errors on a missing command, a missing flag value, and apply xor", () => {
    for (const args of [
      [],
      ["decide"],
      ["decide", "--labels"],
      ["apply", "--manifest", "x.json"],
      ["apply", "--manifest", "x.json", "--level", "patch", "--version", "0.2.1"],
      ["apply", "--manifest", "x.json", "--level", "sideways"],
    ]) {
      const result = runCli(args);
      expect(result.status, `expected usage fail for ${JSON.stringify(args)}`).toBe(1);
      expect(result.stderr).toMatch(/Usage:/);
    }
  });
});
