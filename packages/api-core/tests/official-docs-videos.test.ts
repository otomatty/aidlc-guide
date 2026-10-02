import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InstalledVideoPack } from "@aidlc-guide/official-docs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ReadContext, routeRead } from "../src/handlers/read.ts";

const PAGE = "guide/04-phases-and-stages.md";
let tmp: string;
let pack: InstalledVideoPack;

function ctx(extra: Partial<ReadContext> = {}): ReadContext {
  return {
    workspaceRoot: tmp,
    officialDocsRoot: join(tmp, "official"),
    reader: {} as ReadContext["reader"],
    bridge: {} as ReadContext["bridge"],
    recordDir: async () => ({ error: true, reason: "unused" }),
    selected: () => null,
    matrix: () => null,
    ...extra,
  };
}

const get = (c: ReadContext, path: string) => routeRead(c, new URL(`http://x${path}`));

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "videos-route-"));
  const pageDir = join(tmp, "ext", "media", "videos", "ja", "guide", "p");
  await mkdir(pageDir, { recursive: true });
  await writeFile(
    join(tmp, "ext", "media", "videos", "videos.manifest.json"),
    JSON.stringify({
      formatVersion: 1,
      packId: "official-ja",
      locale: "ja",
      builtAt: "2026-10-01T00:00:00Z",
      pages: [
        { path: PAGE, dir: "ja/guide/p", sourceHash: "a".repeat(64), templates: ["title"], durationSec: 30, bytes: 10 },
      ],
    }),
  );
  await writeFile(join(pageDir, "storyboard.json"), '{"s":1}');
  await writeFile(join(pageDir, "timeline.json"), '{"t":1}');
  await writeFile(join(pageDir, "narration.opus"), "OggS");
  pack = {
    extensionPath: join(tmp, "ext"),
    source: { extensionId: "aidlc.videos", version: "0.3.0", id: "official-ja", locale: "ja", root: "media/videos" },
  };
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("GET /api/official-docs/:locale/videos/<docPath>", () => {
  it("answers none on a host without pack support", async () => {
    const result = await get(ctx(), `/api/official-docs/ja/videos/${PAGE}`);
    expect(result).toEqual({ status: 200, body: { ok: true, value: { status: "none", packs: 0 } } });
  });

  it("serves the selected video with a transport URL for the narration", async () => {
    const result = await get(
      ctx({ videoPacks: () => [pack], mediaUrl: (p) => `vscode-resource:${p}` }),
      `/api/official-docs/ja/videos/${encodeURIComponent("guide")}/04-phases-and-stages.md`,
    );
    expect(result?.status).toBe(200);
    expect(result?.body).toEqual({
      ok: true,
      value: {
        status: "available",
        packId: "official-ja",
        packVersion: "0.3.0",
        freshness: "unknown",
        missingTemplates: [],
        durationSec: 30,
        storyboard: { s: 1 },
        timeline: { t: 1 },
        narrationUrl: `vscode-resource:${join(tmp, "ext/media/videos/ja/guide/p/narration.opus")}`,
      },
    });
  });

  it("never exposes a filesystem path when the transport cannot serve pack files", async () => {
    const result = await get(ctx({ videoPacks: () => [pack] }), `/api/official-docs/ja/videos/${PAGE}`);
    expect(result?.body).toMatchObject({ ok: true, value: { status: "available", narrationUrl: null } });
  });

  it("is not mistaken for a doc page named videos/…", async () => {
    const result = await get(ctx(), "/api/official-docs/ja/videos/guide/missing.md");
    expect(result?.body).toEqual({ ok: true, value: { status: "none", packs: 0 } });
  });

  it("rejects an unknown locale and a malformed path", async () => {
    const badLocale = await get(ctx(), `/api/official-docs/fr/videos/${PAGE}`);
    expect(badLocale?.body).toEqual({ error: true, reason: "path_rejected" });
    const badPath = await get(ctx(), "/api/official-docs/ja/videos/..%2Fsecret.md");
    expect(badPath?.body).toEqual({ error: true, reason: "path_rejected" });
  });
});
