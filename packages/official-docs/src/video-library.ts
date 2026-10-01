/**
 * Read installed doc video packs from disk and answer "which video, if any,
 * goes with this page". Every path is resolved through `guardPath` against the
 * pack (or page) directory it belongs to and every file is size-bounded: pack
 * contents come from another extension and are never trusted to stay inside it.
 */
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { guardPath, readBounded } from "@aidlc-guide/core-utils";
import type { ReadResult } from "@aidlc-guide/shared-types";
import { localeContentRoot, parseDocPath } from "./roots.ts";
import type { DocPath, DocSection, Locale } from "./types.ts";
import {
  parseVideoPackManifest,
  MAX_NARRATION_BYTES,
  rankVideos,
  type SelectedVideo,
  VIDEO_FILES,
  VIDEO_PACK_MANIFEST,
  type VideoCandidate,
  type VideoPackSource,
} from "./video-pack.ts";

/** A pack as the host found it: its declaration plus where its extension lives. */
export interface InstalledVideoPack {
  source: VideoPackSource;
  extensionPath: string;
}

export interface PageVideo extends SelectedVideo {
  storyboard: unknown;
  timeline: unknown;
  /** Absolute path of the narration file, already contained to its page directory. */
  narrationPath: string;
}

export type PageVideoLookup = { found: false; packs: number } | { found: true; video: PageVideo };

/** Manifests and storyboards are small; anything near this is not a doc video. */
const MAX_JSON_BYTES = 1024 * 1024;

async function readGuarded(root: string, rel: string, max: number): Promise<string | null> {
  const guarded = await guardPath(root, rel);
  if (!("ok" in guarded)) return null;
  const read = await readBounded(guarded.value, max);
  return read.ok === true ? read.value : null;
}

function parseJson(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** sha256 of the bundled English original — what a script's `sourceHash` is compared with. */
async function currentEnHash(
  officialDocsRoot: string,
  page: { section: DocSection; relFile: string },
): Promise<string | undefined> {
  const root = localeContentRoot(officialDocsRoot, page.section, "en");
  const text = await readGuarded(root, page.relFile, 10 * MAX_JSON_BYTES);
  return text === null ? undefined : createHash("sha256").update(text).digest("hex");
}

interface RootedCandidate extends VideoCandidate {
  /** The pack root, already contained to its extension. */
  root: string;
}

async function packPages(pack: InstalledVideoPack, docPath: DocPath): Promise<RootedCandidate[]> {
  const root = await guardPath(pack.extensionPath, pack.source.root);
  if (!("ok" in root)) return [];
  const raw = await readGuarded(root.value, VIDEO_PACK_MANIFEST, MAX_JSON_BYTES);
  if (raw === null) return [];
  const manifest = parseVideoPackManifest(raw, pack.source);
  // A broken pack contributes nothing; it must not take other packs or the page down with it.
  if (!("ok" in manifest)) return [];
  return manifest.value.pages
    .filter((entry) => entry.path === docPath)
    .map((entry) => ({ source: pack.source, entry, root: root.value }));
}

async function readPageFiles(
  root: string,
  dir: string,
): Promise<{ storyboard: unknown; timeline: unknown; narrationPath: string } | null> {
  const pageDir = await guardPath(root, dir);
  if (!("ok" in pageDir)) return null;
  const storyboard = parseJson(
    await readGuarded(pageDir.value, VIDEO_FILES.storyboard, MAX_JSON_BYTES),
  );
  const timeline = parseJson(
    await readGuarded(pageDir.value, VIDEO_FILES.timeline, MAX_JSON_BYTES),
  );
  const narration = await guardPath(pageDir.value, VIDEO_FILES.narration);
  if (storyboard === undefined || timeline === undefined || !("ok" in narration)) return null;
  try {
    // Bound the file itself, not the size the manifest claims for it.
    const info = await stat(narration.value);
    if (!info.isFile() || info.size > MAX_NARRATION_BYTES) return null;
  } catch {
    return null;
  }
  return { storyboard, timeline, narrationPath: narration.value };
}

/** Find, choose and read the video for one page. */
export async function findPageVideo(input: {
  officialDocsRoot: string;
  locale: Locale;
  docPath: DocPath;
  packs: readonly InstalledVideoPack[];
  knownTemplates: ReadonlySet<string>;
}): Promise<ReadResult<PageVideoLookup>> {
  const page = parseDocPath(input.docPath);
  if (page === null || page.docPath !== input.docPath) {
    return { error: true, reason: "path_rejected" };
  }
  const packs = input.packs.filter((p) => p.source.locale === input.locale);
  const none: ReadResult<PageVideoLookup> = {
    ok: true,
    value: { found: false, packs: packs.length },
  };
  const candidates = (await Promise.all(packs.map((p) => packPages(p, input.docPath)))).flat();
  const enHash = await currentEnHash(input.officialDocsRoot, page);
  // Best first; a candidate whose files are missing or oversized gives way to the next.
  for (const candidate of rankVideos(candidates, enHash, input.knownTemplates)) {
    const files = await readPageFiles(candidate.root, candidate.entry.dir);
    if (files === null) continue;
    const { root: _root, ...video } = candidate;
    return { ok: true, value: { found: true, video: { ...video, ...files } } };
  }
  return none;
}
