import { describe, expect, it } from "vitest";
import {
  compareVersions,
  isSafeRelativePath,
  PACK_BUDGET_BYTES,
  PAGE_BUDGET_BYTES,
  packBudgetViolations,
  parsePackContributions,
  parseVideoPackManifest,
  selectVideo,
  type VideoCandidate,
  type VideoPackSource,
  type VideoPageEntry,
  videoFreshness,
} from "../src/video-pack.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function packageJson(packs: unknown, extra: Record<string, unknown> = {}) {
  return { name: "aidlc-guide-videos-ja", version: "0.1.0", contributes: { aidlcGuideVideoPacks: packs }, ...extra };
}

const PACK = { id: "official-ja", locale: "ja", formatVersion: 1, root: "media/videos" };

const SOURCE: VideoPackSource = {
  extensionId: "aidlc.aidlc-guide-videos-ja",
  version: "0.1.0",
  id: "official-ja",
  locale: "ja",
  root: "media/videos",
};

function page(overrides: Partial<VideoPageEntry> = {}): VideoPageEntry {
  return {
    path: "guide/04-phases-and-stages.md",
    dir: "ja/guide/04-phases-and-stages",
    sourceHash: HASH_A,
    templates: ["title", "cards"],
    durationSec: 172.4,
    bytes: 281_000,
    ...overrides,
  };
}

function manifest(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    formatVersion: 1,
    packId: "official-ja",
    locale: "ja",
    builtAt: "2026-10-01T00:00:00Z",
    pages: [page()],
    ...overrides,
  });
}

describe("isSafeRelativePath", () => {
  it.each(["media/videos", "ja/guide/04-phases-and-stages", "a"])("accepts %s", (p) => {
    expect(isSafeRelativePath(p)).toBe(true);
  });

  it.each([
    "",
    "/etc",
    "C:/x",
    "c:x",
    "..",
    "a/../b",
    "./a",
    "a//b",
    "a/",
    "a\\b",
    "a\0b",
    42,
    null,
  ])("rejects %j", (p) => {
    expect(isSafeRelativePath(p)).toBe(false);
  });
});

describe("parsePackContributions", () => {
  it("reads a trusted pack", () => {
    expect(parsePackContributions("aidlc.aidlc-guide-videos-ja", packageJson([PACK]))).toEqual({
      ok: true,
      value: [SOURCE],
    });
  });

  it("matches the publisher case-insensitively, as VS Code does", () => {
    const result = parsePackContributions("AIDLC.videos", packageJson([PACK]));
    expect(result).toMatchObject({ ok: true });
  });

  it("yields nothing for extensions that declare no pack", () => {
    expect(parsePackContributions("other.ext", { contributes: {} })).toEqual({ ok: true, value: [] });
    expect(parsePackContributions("other.ext", { name: "x" })).toEqual({ ok: true, value: [] });
    expect(parsePackContributions("other.ext", null)).toEqual({ ok: true, value: [] });
  });

  it("refuses packs from untrusted publishers", () => {
    expect(parsePackContributions("someone.videos", packageJson([PACK]))).toEqual({
      error: true,
      reason: "untrusted-publisher",
    });
    expect(parsePackContributions("", packageJson([PACK]))).toMatchObject({ reason: "untrusted-publisher" });
  });

  it("accepts an explicitly trusted publisher", () => {
    expect(parsePackContributions("someone.videos", packageJson([PACK]), ["someone"])).toMatchObject({ ok: true });
  });

  it("reports an unsupported layout version", () => {
    expect(
      parsePackContributions("aidlc.v", packageJson([{ ...PACK, formatVersion: 2 }])),
    ).toEqual({ unsupported: true, version: "2" });
  });

  it.each([
    ["no entries", packageJson([])],
    ["not an array", packageJson({ ...PACK })],
    ["missing version", packageJson([PACK], { version: "" })],
    ["non-object entry", packageJson(["x"])],
    ["formatVersion type", packageJson([{ ...PACK, formatVersion: "1" }])],
    ["bad id", packageJson([{ ...PACK, id: "Bad Id" }])],
    ["duplicate id", packageJson([PACK, PACK])],
    ["bad locale", packageJson([{ ...PACK, locale: "fr" }])],
    ["locale type", packageJson([{ ...PACK, locale: 1 }])],
    ["escaping root", packageJson([{ ...PACK, root: "../outside" }])],
  ])("refuses a malformed declaration: %s", (_label, pkg) => {
    const result = parsePackContributions("aidlc.v", pkg);
    expect(result).toMatchObject({ error: true });
    expect("reason" in result && result.reason).toMatch(/^malformed-pack: /);
  });
});

describe("parseVideoPackManifest", () => {
  it("reads a valid manifest", () => {
    const result = parseVideoPackManifest(manifest(), SOURCE);
    expect(result).toEqual({
      ok: true,
      value: {
        formatVersion: 1,
        packId: "official-ja",
        locale: "ja",
        builtAt: "2026-10-01T00:00:00Z",
        pages: [page()],
      },
    });
  });

  it("reports an unsupported layout version", () => {
    expect(parseVideoPackManifest(manifest({ formatVersion: 9 }), SOURCE)).toEqual({
      unsupported: true,
      version: "9",
    });
  });

  it.each([
    ["not JSON", "{"],
    ["not an object", "[]"],
    ["other pack", manifest({ packId: "other" })],
    ["other locale", manifest({ locale: "en" })],
    ["bad builtAt", manifest({ builtAt: "yesterday" })],
    ["builtAt type", manifest({ builtAt: 1 })],
    ["pages type", manifest({ pages: {} })],
    ["page not object", manifest({ pages: [1] })],
    ["unknown section", manifest({ pages: [page({ path: "nope/x.md" })] })],
    ["not markdown", manifest({ pages: [page({ path: "guide/x.txt" })] })],
    ["non-canonical path", manifest({ pages: [page({ path: "/guide/x.md" })] })],
    ["path type", manifest({ pages: [{ ...page(), path: 3 }] })],
    ["escaping dir", manifest({ pages: [page({ dir: "../../etc" })] })],
    ["short hash", manifest({ pages: [page({ sourceHash: "abc" })] })],
    ["hash type", manifest({ pages: [{ ...page(), sourceHash: 1 }] })],
    ["template name", manifest({ pages: [page({ templates: ["<script>"] })] })],
    ["templates type", manifest({ pages: [{ ...page(), templates: "cards" }] })],
    ["zero duration", manifest({ pages: [page({ durationSec: 0 })] })],
    ["too long", manifest({ pages: [page({ durationSec: 600 })] })],
    ["NaN duration", manifest({ pages: [{ ...page(), durationSec: "1" }] })],
    ["fractional bytes", manifest({ pages: [page({ bytes: 1.5 })] })],
    ["negative bytes", manifest({ pages: [page({ bytes: -1 })] })],
    ["bytes type", manifest({ pages: [{ ...page(), bytes: "1" }] })],
    ["duplicate page", manifest({ pages: [page(), page()] })],
  ])("refuses %s", (_label, raw) => {
    const result = parseVideoPackManifest(raw, SOURCE);
    expect(result).toMatchObject({ error: true });
    expect("reason" in result && result.reason).toMatch(/^malformed-pack: /);
  });
});

describe("videoFreshness", () => {
  it("compares the script's source hash with the bundled original", () => {
    expect(videoFreshness({ sourceHash: HASH_A }, HASH_A)).toBe("fresh");
    expect(videoFreshness({ sourceHash: HASH_A }, HASH_B)).toBe("stale");
    expect(videoFreshness({ sourceHash: HASH_A }, undefined)).toBe("unknown");
  });
});

describe("compareVersions", () => {
  it("orders numerically, not lexically, and ignores pre-release tags", () => {
    expect(compareVersions("1.10.0", "1.9.3")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "0.1.1")).toBeLessThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe(0);
    expect(compareVersions("x", "0")).toBe(0);
  });
});

describe("selectVideo", () => {
  const known = new Set(["title", "cards"]);
  const candidate = (
    version: string,
    entry: Partial<VideoPageEntry> = {},
    id = "official-ja",
  ): VideoCandidate => ({ source: { ...SOURCE, version, id }, entry: page(entry) });

  it("returns null when no pack covers the page", () => {
    expect(selectVideo([], HASH_A, known)).toBeNull();
  });

  it("prefers a fresh video over a newer stale one", () => {
    const fresh = candidate("0.1.0");
    const stale = candidate("0.2.0", { sourceHash: HASH_B });
    expect(selectVideo([stale, fresh], HASH_A, known)).toMatchObject({
      source: fresh.source,
      freshness: "fresh",
      missingTemplates: [],
    });
  });

  it("prefers a playable video over a fresh one this host cannot render", () => {
    const future = candidate("0.3.0", { templates: ["title", "hologram"] });
    const playable = candidate("0.1.0", { sourceHash: HASH_B });
    expect(selectVideo([future, playable], HASH_A, known)).toMatchObject({
      source: playable.source,
      freshness: "stale",
    });
  });

  it("still offers an unplayable video, naming what is missing", () => {
    const future = candidate("0.3.0", { templates: ["title", "hologram"] });
    expect(selectVideo([future], HASH_A, known)?.missingTemplates).toEqual(["hologram"]);
  });

  it("breaks ties by pack version, then pack id", () => {
    const older = candidate("0.1.0");
    const newer = candidate("0.10.0");
    expect(selectVideo([older, newer], HASH_A, known)?.source.version).toBe("0.10.0");
    const a = candidate("0.1.0", {}, "a-pack");
    const b = candidate("0.1.0", {}, "b-pack");
    expect(selectVideo([b, a], undefined, known)?.source.id).toBe("a-pack");
  });

  it("ranks unknown freshness between fresh and stale", () => {
    const stale = candidate("0.9.0", { sourceHash: HASH_B });
    const fresh = candidate("0.1.0");
    expect(selectVideo([stale, fresh], undefined, known)?.freshness).toBe("unknown");
  });
});

describe("packBudgetViolations", () => {
  it("is empty within budget", () => {
    expect(packBudgetViolations({ pages: [page()] })).toEqual([]);
  });

  it("names oversized pages and an oversized pack", () => {
    const big = page({ bytes: PAGE_BUDGET_BYTES + 1 });
    expect(packBudgetViolations({ pages: [big] })).toEqual([
      `guide/04-phases-and-stages.md: ${PAGE_BUDGET_BYTES + 1} bytes > ${PAGE_BUDGET_BYTES}`,
    ]);
    const many = Array.from({ length: 100 }, (_, i) => page({ path: `guide/p${i}.md`, bytes: PAGE_BUDGET_BYTES }));
    expect(packBudgetViolations({ pages: many }).at(-1)).toBe(
      `pack total: ${100 * PAGE_BUDGET_BYTES} bytes > ${PACK_BUDGET_BYTES}`,
    );
  });
});
