import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agreement, planPacks, writePack } from "../src/pack.ts";

const EN = "# Page\n";
const EN_HASH = createHash("sha256").update(EN).digest("hex");

let repo: string;
let packDir: string;

function storyboard(overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    page: "guide/sample.md",
    sourceHash: EN_HASH,
    title: "T",
    chapters: [{ id: "a", title: "A", template: "title", cues: [{ text: "x" }], data: { headline: "H" } }],
    ...overrides,
  };
}

const TIMELINE = { formatVersion: 1, duration: 4, chapters: [{ id: "a", start: 0, duration: 4, cues: [{ start: 1, end: 3 }] }] };

async function page(rel: string, files: Record<string, string | null> = {}): Promise<string> {
  const dir = path.join(repo, "docs", "videos", "ja", ...rel.split("/"));
  await mkdir(dir, { recursive: true });
  const all: Record<string, string | null> = {
    "storyboard.json": JSON.stringify(storyboard()),
    "timeline.json": JSON.stringify(TIMELINE),
    "narration.opus": "OggS-audio",
    "captions.vtt": "WEBVTT\n",
    ...files,
  };
  for (const [name, content] of Object.entries(all)) {
    if (content !== null) await writeFile(path.join(dir, name), content);
  }
  return dir;
}

async function pack(config: unknown = { "official-ja": { sections: ["guide"] } }, contributes?: unknown) {
  await mkdir(packDir, { recursive: true });
  await writeFile(
    path.join(packDir, "package.json"),
    JSON.stringify({
      publisher: "aidlc",
      name: "videos-ja",
      version: "0.1.0",
      contributes: contributes ?? {
        aidlcGuideVideoPacks: [{ id: "official-ja", locale: "ja", formatVersion: 1, root: "media/videos" }],
      },
    }),
  );
  await writeFile(path.join(packDir, "video-pack.config.json"), JSON.stringify(config));
}

beforeEach(async () => {
  repo = await mkdtemp(path.join(tmpdir(), "video-pack-"));
  packDir = path.join(repo, "packages", "video-pack-ja");
  await mkdir(path.join(repo, "docs", "guide", "en"), { recursive: true });
  await writeFile(path.join(repo, "docs", "guide", "en", "sample.md"), EN);
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("planPacks", () => {
  it("plans a valid page with its manifest entry", async () => {
    await pack();
    await page("guide/sample");
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors).toEqual([]);
    expect(plan?.warnings).toEqual([]);
    expect(plan?.pages.map((p) => p.entry)).toEqual([
      {
        path: "guide/sample.md",
        dir: "ja/guide/sample",
        sourceHash: EN_HASH,
        templates: ["title"],
        durationSec: 4,
        bytes: "OggS-audio".length + JSON.stringify(storyboard()).length + JSON.stringify(TIMELINE).length + "WEBVTT\n".length,
      },
    ]);
  });

  it("finds nested pages and only the configured sections", async () => {
    await pack();
    await writeFile(path.join(repo, "docs", "guide", "en", "nested.md"), EN);
    await mkdir(path.join(repo, "docs", "guide", "en", "agents"), { recursive: true });
    await writeFile(path.join(repo, "docs", "guide", "en", "agents", "dev.md"), EN);
    await page("guide/agents/dev", { "storyboard.json": JSON.stringify(storyboard({ page: "guide/agents/dev.md" })) });
    await page("reference/other");
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.pages.map((p) => p.docPath)).toEqual(["guide/agents/dev.md"]);
  });

  it("warns, without failing, when the English page changed after the script", async () => {
    await pack();
    await page("guide/sample", { "storyboard.json": JSON.stringify(storyboard({ sourceHash: "0".repeat(64) })) });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors).toEqual([]);
    expect(plan?.warnings[0]).toMatch(/stale/);
  });

  it("reads the size an LFS pointer stands for and marks it", async () => {
    await pack();
    await page("guide/sample", {
      "narration.opus": "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 270000\n",
    });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.pages[0]?.pointer).toBe(true);
    expect(plan?.pages[0]?.entry.bytes).toBeGreaterThan(270000);
  });

  it("treats a pointer without a size as empty", async () => {
    await pack();
    await page("guide/sample", { "narration.opus": "version https://git-lfs.github.com/spec/v1\n" });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.pages[0]?.pointer).toBe(true);
  });

  it.each([
    ["a missing file", { "captions.vtt": null }, /missing captions\.vtt/],
    ["a bad storyboard", { "storyboard.json": "{}" }, /storyboard/],
    ["a bad timeline", { "timeline.json": "{}" }, /timeline/],
    ["the wrong page", { "storyboard.json": JSON.stringify(storyboard({ page: "guide/other.md" })) }, /expected guide\/sample\.md/],
    [
      "an unknown template",
      { "storyboard.json": JSON.stringify(storyboard({ chapters: [{ id: "a", title: "A", template: "hologram", cues: [{ text: "x" }] }] })) },
      /unknown template hologram/,
    ],
    [
      "a timeline for other chapters",
      { "timeline.json": JSON.stringify({ ...TIMELINE, chapters: [{ ...TIMELINE.chapters[0], id: "z" }] }) },
      /disagree/,
    ],
  ])("reports %s", async (_label, files, message) => {
    await pack();
    await page("guide/sample", files);
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors.join("\n")).toMatch(message);
    expect(plan?.pages).toEqual([]);
  });

  it("checks a page without narration as a draft and leaves it out of the pack", async () => {
    await pack();
    await page("guide/sample", { "narration.opus": null, "timeline.json": null, "captions.vtt": null });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors).toEqual([]);
    expect(plan?.pages).toEqual([]);
    expect(plan?.warnings).toEqual(["docs/videos/ja/guide/sample: draft — no narration.opus yet, not packed"]);
  });

  it("still reports a broken draft", async () => {
    await pack();
    await page("guide/sample", {
      "narration.opus": null,
      "storyboard.json": JSON.stringify(storyboard({ page: "guide/elsewhere.md" })),
    });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors.join("\n")).toMatch(/expected guide\/sample\.md/);
    expect(plan?.warnings).toEqual([]);
  });

  it("reports a page without an English original", async () => {
    await pack();
    await page("guide/orphan", { "storyboard.json": JSON.stringify(storyboard({ page: "guide/orphan.md" })) });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors[0]).toMatch(/no English original/);
  });

  it("reports a page outside any documentation section", async () => {
    await pack({ "official-ja": { sections: ["guide"] } });
    const dir = path.join(repo, "docs", "videos", "ja", "guide");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "storyboard.json"), "{}");
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors[0]).toMatch(/not under a documentation section/);
  });

  it("reports pages over the size budget", async () => {
    await pack();
    await page("guide/sample", {
      "narration.opus": "version https://git-lfs.github.com/spec/v1\nsize 999999\n",
    });
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.errors.join("\n")).toMatch(/bytes >/);
  });

  it("rejects a pack directory that declares no valid pack, or no sections", async () => {
    await pack(undefined, {});
    await expect(planPacks(repo, packDir)).rejects.toThrow(/does not declare/);
    await pack({ "official-ja": { sections: ["nope"] } });
    await expect(planPacks(repo, packDir)).rejects.toThrow(/list of doc sections/);
  });

  it("plans an empty pack when no videos exist yet", async () => {
    await pack();
    const [plan] = await planPacks(repo, packDir);
    expect(plan?.pages).toEqual([]);
  });
});

describe("writePack", () => {
  it("copies page files and writes the manifest", async () => {
    await pack();
    await page("guide/sample");
    const [plan] = await planPacks(repo, packDir);
    if (plan === undefined) throw new Error("no plan");
    const manifest = await writePack(packDir, plan, new Date("2026-10-01T00:00:00Z"));
    expect(manifest).toMatchObject({ packId: "official-ja", locale: "ja", builtAt: "2026-10-01T00:00:00.000Z" });
    const root = path.join(packDir, "media", "videos");
    expect(existsSync(path.join(root, "ja", "guide", "sample", "narration.opus"))).toBe(true);
    const written = JSON.parse(await readFile(path.join(root, "videos.manifest.json"), "utf8"));
    expect(written).toEqual(manifest);
  });

  it("refuses to package LFS pointers or a plan with errors", async () => {
    await pack();
    await page("guide/sample", { "narration.opus": "version https://git-lfs.github.com/spec/v1\nsize 10\n" });
    const [plan] = await planPacks(repo, packDir);
    if (plan === undefined) throw new Error("no plan");
    await expect(writePack(packDir, plan, new Date())).rejects.toThrow(/git lfs pull/);
    await expect(writePack(packDir, { ...plan, errors: ["x"] }, new Date())).rejects.toThrow(/has errors/);
  });
});

describe("agreement", () => {
  it("accepts matching chapters and names the first mismatch", () => {
    const sb = storyboard() as never;
    expect(agreement(sb, TIMELINE as never)).toBeNull();
    expect(agreement(sb, { ...TIMELINE, chapters: [] } as never)).toMatch(/count/);
    expect(
      agreement(sb, { ...TIMELINE, chapters: [{ ...TIMELINE.chapters[0], cues: [] }] } as never),
    ).toMatch(/caption count/);
  });
});
