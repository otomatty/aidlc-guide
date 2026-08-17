import { describe, expect, it } from "vitest";
import {
  compareSemver,
  decideUpdate,
  isVsixBuffer,
  parseLatestRelease,
  parseSemver,
  vsixAssetName,
  vsixDownloadUrl,
} from "../src/update-release.ts";

describe("parseSemver", () => {
  it("reads dotted triples and optional v prefix", () => {
    expect(parseSemver("0.2.0")).toEqual({
      major: 0,
      minor: 2,
      patch: 0,
      prerelease: "",
    });
    expect(parseSemver("v1.0.0")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "",
    });
    expect(parseSemver("0.2.0-rc.1")?.prerelease).toBe("rc.1");
    expect(parseSemver("dev")).toBeNull();
  });
});

describe("compareSemver", () => {
  it("orders release ahead of prerelease", () => {
    const a = parseSemver("0.2.0");
    const b = parseSemver("0.2.0-rc.1");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (a === null || b === null) return;
    expect(compareSemver(a, b)).toBeGreaterThan(0);
    expect(compareSemver(b, a)).toBeLessThan(0);
    expect(compareSemver(a, a)).toBe(0);
  });

  it("orders numeric prerelease identifiers and ignores build metadata", () => {
    const rc2 = parseSemver("1.0.0-rc.2");
    const rc10 = parseSemver("1.0.0-rc.10");
    const withBuild = parseSemver("1.0.0+build.9");
    const plain = parseSemver("1.0.0");
    expect(rc2).not.toBeNull();
    expect(rc10).not.toBeNull();
    expect(withBuild).not.toBeNull();
    expect(plain).not.toBeNull();
    if (rc2 === null || rc10 === null || withBuild === null || plain === null) return;
    expect(compareSemver(rc10, rc2)).toBeGreaterThan(0);
    expect(compareSemver(rc2, rc10)).toBeLessThan(0);
    expect(compareSemver(withBuild, plain)).toBe(0);
    expect(parseSemver("1.0.0+build.9")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "",
    });
  });
});

describe("parseLatestRelease", () => {
  it("accepts a public latest release with the expected VSIX name", () => {
    expect(
      parseLatestRelease({
        tag_name: "v0.2.0",
        draft: false,
        prerelease: false,
        assets: [{ name: "aidlc-guide-0.2.0.vsix" }],
      }),
    ).toEqual({
      ok: true,
      value: { version: "0.2.0", tag: "v0.2.0", assetName: "aidlc-guide-0.2.0.vsix" },
    });
  });

  it("rejects drafts, bad tags, and missing assets", () => {
    expect(parseLatestRelease(null)).toEqual({ ok: false, reason: "invalid-json" });
    expect(parseLatestRelease({ tag_name: "v0.2.0", prerelease: true, assets: [] })).toEqual({
      ok: false,
      reason: "draft-or-prerelease",
    });
    expect(parseLatestRelease({ tag_name: "../evil", assets: [] })).toEqual({
      ok: false,
      reason: "invalid-tag",
    });
    expect(parseLatestRelease({ tag_name: "v0.2.0", assets: [{ name: "other.zip" }] })).toEqual({
      ok: false,
      reason: "missing-asset",
    });
  });
});

describe("decideUpdate / vsix helpers", () => {
  const latest = { version: "0.2.0", tag: "v0.2.0", assetName: vsixAssetName("0.2.0") };

  it("reports available, up-to-date, and invalid current", () => {
    expect(decideUpdate("0.1.0", latest)).toEqual({ kind: "available", current: "0.1.0", latest });
    expect(decideUpdate("0.2.0", latest)).toEqual({
      kind: "up-to-date",
      current: "0.2.0",
      latest: "0.2.0",
    });
    expect(decideUpdate("dev", latest)).toEqual({ kind: "invalid-current", current: "dev" });
  });

  it("builds the first-party download URL from the tag", () => {
    expect(vsixDownloadUrl(latest)).toBe(
      "https://github.com/otomatty/aidlc-guide/releases/download/v0.2.0/aidlc-guide-0.2.0.vsix",
    );
  });

  it("requires a ZIP magic header and a minimum size", () => {
    const ok = new Uint8Array(100);
    ok[0] = 0x50;
    ok[1] = 0x4b;
    expect(isVsixBuffer(ok)).toBe(true);
    expect(isVsixBuffer(new Uint8Array(100))).toBe(false);
    expect(isVsixBuffer(ok.slice(0, 50))).toBe(false);
  });
});
