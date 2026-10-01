import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findPageVideo, type InstalledVideoPack } from "../src/video-library.ts";
import type { VideoPackSource } from "../src/video-pack.ts";

const PAGE = "guide/04-phases-and-stages.md";
const EN_TEXT = "# Phases and stages\n";
const EN_HASH = createHash("sha256").update(EN_TEXT).digest("hex");
const KNOWN = new Set(["title", "points", "flow"]);

let tmp: string;
let docsRoot: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "video-library-"));
  docsRoot = join(tmp, "official");
  await mkdir(join(docsRoot, "docs", "guide", "en"), { recursive: true });
  await writeFile(join(docsRoot, "docs", "guide", "en", "04-phases-and-stages.md"), EN_TEXT);
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

interface PackOptions {
  name?: string;
  version?: string;
  sourceHash?: string;
  templates?: string[];
  dir?: string;
  manifest?: string;
  files?: Partial<Record<"storyboard.json" | "timeline.json" | "narration.opus", string | null>>;
}

async function makePack(o: PackOptions = {}): Promise<InstalledVideoPack> {
  const extensionPath = join(tmp, o.name ?? "pack");
  const root = join(extensionPath, "media", "videos");
  const dir = o.dir ?? "ja/guide/04-phases-and-stages";
  await mkdir(join(root, "ja", "guide", "04-phases-and-stages"), { recursive: true });
  const manifest =
    o.manifest ??
    JSON.stringify({
      formatVersion: 1,
      packId: "official-ja",
      locale: "ja",
      builtAt: "2026-10-01T00:00:00Z",
      pages: [
        {
          path: PAGE,
          dir,
          sourceHash: o.sourceHash ?? EN_HASH,
          templates: o.templates ?? ["title"],
          durationSec: 12.5,
          bytes: 100,
        },
      ],
    });
  await writeFile(join(root, "videos.manifest.json"), manifest);
  const files = {
    "storyboard.json": JSON.stringify({ formatVersion: 1, page: PAGE }),
    "timeline.json": JSON.stringify({ formatVersion: 1, duration: 12.5 }),
    "narration.opus": "OggS",
    ...o.files,
  };
  for (const [file, content] of Object.entries(files)) {
    if (content !== null) await writeFile(join(root, "ja", "guide", "04-phases-and-stages", file), content);
  }
  const source: VideoPackSource = {
    extensionId: `aidlc.${o.name ?? "pack"}`,
    version: o.version ?? "0.1.0",
    id: "official-ja",
    locale: "ja",
    root: "media/videos",
  };
  return { source, extensionPath };
}

function find(packs: InstalledVideoPack[], docPath = PAGE, locale: "ja" | "en" = "ja") {
  return findPageVideo({ officialDocsRoot: docsRoot, locale, docPath, packs, knownTemplates: KNOWN });
}

describe("findPageVideo", () => {
  it("reads the selected page's storyboard, timeline and narration path", async () => {
    const pack = await makePack();
    const result = await find([pack]);
    expect(result).toMatchObject({
      ok: true,
      value: {
        found: true,
        video: {
          freshness: "fresh",
          missingTemplates: [],
          storyboard: { formatVersion: 1, page: PAGE },
          timeline: { duration: 12.5 },
          narrationPath: join(pack.extensionPath, "media/videos/ja/guide/04-phases-and-stages/narration.opus"),
        },
      },
    });
  });

  it("marks a video stale when the English page changed after the script", async () => {
    const result = await find([await makePack({ sourceHash: "0".repeat(64) })]);
    expect(result).toMatchObject({ value: { video: { freshness: "stale" } } });
  });

  it("reports unknown freshness when the English page is not bundled", async () => {
    await rm(join(docsRoot, "docs"), { recursive: true });
    expect(await find([await makePack()])).toMatchObject({ value: { video: { freshness: "unknown" } } });
  });

  it("says how many packs exist when none covers the page", async () => {
    const pack = await makePack();
    expect(await find([pack], "guide/other.md")).toEqual({ ok: true, value: { found: false, packs: 1 } });
    expect(await find([], PAGE)).toEqual({ ok: true, value: { found: false, packs: 0 } });
    expect(await find([pack], PAGE, "en")).toEqual({ ok: true, value: { found: false, packs: 0 } });
  });

  it("never reads an English original outside its locale root", async () => {
    const pack = await makePack();
    expect(await find([pack], "guide/../../secret.md")).toEqual({
      ok: true,
      value: { found: false, packs: 1 },
    });
  });

  it("rejects a malformed page path", async () => {
    expect(await find([], "../x.md")).toEqual({ error: true, reason: "path_rejected" });
    expect(await find([], "/guide/x.md")).toEqual({ error: true, reason: "path_rejected" });
  });

  it("prefers the newer of two fresh packs and ignores a broken one", async () => {
    const older = await makePack({ name: "older", version: "0.1.0" });
    const newer = await makePack({ name: "newer", version: "0.2.0" });
    const broken = await makePack({ name: "broken", manifest: "{" });
    const result = await find([older, broken, newer]);
    expect(result).toMatchObject({ value: { video: { source: { version: "0.2.0" } } } });
  });

  it("skips a pack whose manifest is missing", async () => {
    const pack = await makePack();
    await rm(join(pack.extensionPath, "media", "videos", "videos.manifest.json"));
    expect(await find([pack])).toEqual({ ok: true, value: { found: false, packs: 1 } });
  });

  it.each([
    ["storyboard missing", { "storyboard.json": null }],
    ["timeline not JSON", { "timeline.json": "{" }],
    ["narration missing", { "narration.opus": null }],
  ])("offers nothing when the page files are incomplete (%s)", async (_label, files) => {
    expect(await find([await makePack({ files })])).toEqual({ ok: true, value: { found: false, packs: 1 } });
  });

  it("offers nothing when the narration is a directory", async () => {
    const pack = await makePack({ files: { "narration.opus": null } });
    await mkdir(join(pack.extensionPath, "media/videos/ja/guide/04-phases-and-stages/narration.opus"));
    expect(await find([pack])).toEqual({ ok: true, value: { found: false, packs: 1 } });
  });

  it("does not follow a page directory that escapes the pack through a symlink", async () => {
    const outside = join(tmp, "outside");
    await mkdir(outside, { recursive: true });
    for (const f of ["storyboard.json", "timeline.json", "narration.opus"]) await writeFile(join(outside, f), "{}");
    const pack = await makePack({ dir: "ja/escape" });
    await symlink(outside, join(pack.extensionPath, "media", "videos", "ja", "escape"), "dir");
    expect(await find([pack])).toEqual({ ok: true, value: { found: false, packs: 1 } });
  });

  it("does not follow a pack root that escapes the extension", async () => {
    const victim = await makePack({ name: "victim" });
    const attacker = join(tmp, "attacker");
    await mkdir(attacker);
    const escaped = {
      extensionPath: attacker,
      source: { ...victim.source, root: "../victim/media/videos" },
    };
    expect(await find([escaped])).toEqual({ ok: true, value: { found: false, packs: 1 } });
  });

  it("still offers a video this build cannot draw, naming the templates", async () => {
    const result = await find([await makePack({ templates: ["title", "hologram"] })]);
    expect(result).toMatchObject({ value: { video: { missingTemplates: ["hologram"] } } });
  });
});
