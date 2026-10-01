/**
 * Doc video packs: separately installed, data-only VS Code extensions that
 * carry narrated explainer videos for official-docs pages.
 *
 * A pack declares itself in its `package.json`:
 *
 *   "contributes": { "aidlcGuideVideoPacks": [
 *     { "id": "official-ja", "locale": "ja", "formatVersion": 1, "root": "media/videos" } ] }
 *
 * and ships `<root>/videos.manifest.json` plus one directory per page holding
 * the fixed {@link VIDEO_FILES}. Packs contain no code: the host extension
 * owns the renderer and the scene templates, and a pack only supplies text,
 * numbers and audio. Everything here is pure validation and selection; the
 * filesystem reads (through `guardPath`) belong to the host.
 */
import type { DocVideoFreshness, ReadResult } from "@aidlc-guide/shared-types";
import { isLocale, parseDocPath } from "./roots.ts";
import type { DocPath, Locale } from "./types.ts";

/** The `contributes` key a pack declares. */
export const VIDEO_PACK_CONTRIBUTION = "aidlcGuideVideoPacks";
/** Pack layout version this host reads. */
export const VIDEO_PACK_FORMAT = 1;
/** Publishers whose packs are loaded. Third-party packs are not accepted. */
export const TRUSTED_PACK_PUBLISHERS: readonly string[] = ["aidlc"];
export const VIDEO_PACK_MANIFEST = "videos.manifest.json";
/** The files every page directory holds. Fixed names: nothing for a pack to point elsewhere. */
export const VIDEO_FILES = {
  storyboard: "storyboard.json",
  timeline: "timeline.json",
  narration: "narration.opus",
  captions: "captions.vtt",
} as const;
/** A page video is a ~3 minute summary; anything far longer is a broken build. */
export const MAX_VIDEO_SECONDS = 200;
/** Size budget per pack VSIX (team decision) and per page (3 min of 12 kbps Opus + JSON). */
export const PACK_BUDGET_BYTES = 30 * 1024 * 1024;
export const PAGE_BUDGET_BYTES = 330 * 1024;
/**
 * Largest narration file the host will hand to a webview. Generous against
 * the page budget, but it bounds what a malformed or hostile pack can make
 * the player download.
 */
export const MAX_NARRATION_BYTES = 2 * PAGE_BUDGET_BYTES;

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const TEMPLATE_RE = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

/** A pack the host has accepted from one extension's `package.json`. */
export interface VideoPackSource {
  /** `publisher.name` of the extension carrying the pack. */
  extensionId: string;
  /** The extension's version — the tie-break between packs covering one page. */
  version: string;
  id: string;
  locale: Locale;
  /** Pack root, relative to the extension root (POSIX). */
  root: string;
}

export interface VideoPageEntry {
  path: DocPath;
  /** Page directory, relative to the pack root (POSIX). */
  dir: string;
  /** sha256 of the English original the script was written from. */
  sourceHash: string;
  /** Scene templates the storyboard uses; the host must know every one. */
  templates: string[];
  durationSec: number;
  bytes: number;
}

export interface VideoPackManifest {
  formatVersion: typeof VIDEO_PACK_FORMAT;
  packId: string;
  locale: Locale;
  builtAt: string;
  pages: VideoPageEntry[];
}

type VideoFreshness = DocVideoFreshness;

const malformed = (detail: string): ReadResult<never> => ({
  error: true,
  reason: `malformed-pack: ${detail}`,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A relative POSIX path that stays where it is put: no absolute or drive
 * prefix, no backslashes, no empty, `.` or `..` segments. A lexical pre-check
 * only — the host still resolves every read through `guardPath`.
 */
export function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value === "" || value.includes("\0")) return false;
  if (value.startsWith("/") || value.includes("\\") || /^[a-zA-Z]:/.test(value)) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * Read the packs one extension declares. An extension that declares none
 * yields `[]`; one from an untrusted publisher, or with a malformed
 * declaration, is refused as a whole.
 */
export function parsePackContributions(
  extensionId: string,
  packageJson: unknown,
  trusted: readonly string[] = TRUSTED_PACK_PUBLISHERS,
): ReadResult<VideoPackSource[]> {
  const contributes = isRecord(packageJson) ? packageJson.contributes : undefined;
  const declared = isRecord(contributes) ? contributes[VIDEO_PACK_CONTRIBUTION] : undefined;
  if (declared === undefined) return { ok: true, value: [] };
  const publisher = extensionId.split(".")[0]?.toLowerCase() ?? "";
  if (!trusted.includes(publisher)) return { error: true, reason: "untrusted-publisher" };
  if (!Array.isArray(declared) || declared.length === 0) return malformed("no pack entries");
  const version = isRecord(packageJson) ? packageJson.version : undefined;
  if (typeof version !== "string" || version === "") return malformed("missing version");

  const packs: VideoPackSource[] = [];
  for (const entry of declared) {
    if (!isRecord(entry)) return malformed("pack entry is not an object");
    const { id, locale, formatVersion, root } = entry;
    if (typeof formatVersion !== "number") return malformed("formatVersion");
    if (formatVersion !== VIDEO_PACK_FORMAT) {
      return { unsupported: true, version: String(formatVersion) };
    }
    if (typeof id !== "string" || !ID_RE.test(id)) return malformed("id");
    if (packs.some((p) => p.id === id)) return malformed(`duplicate id ${id}`);
    if (typeof locale !== "string" || !isLocale(locale)) return malformed("locale");
    if (!isSafeRelativePath(root)) return malformed("root");
    packs.push({ extensionId, version, id, locale, root });
  }
  return { ok: true, value: packs };
}

function parsePage(value: unknown): VideoPageEntry | string {
  if (!isRecord(value)) return "page entry is not an object";
  const { path, dir, sourceHash, templates, durationSec, bytes } = value;
  if (typeof path !== "string" || parseDocPath(path)?.docPath !== path || !path.endsWith(".md")) {
    return "page path";
  }
  if (!isSafeRelativePath(dir)) return `dir of ${path}`;
  if (typeof sourceHash !== "string" || !SHA256_RE.test(sourceHash)) {
    return `sourceHash of ${path}`;
  }
  if (
    !Array.isArray(templates) ||
    !templates.every((t): t is string => typeof t === "string" && TEMPLATE_RE.test(t))
  ) {
    return `templates of ${path}`;
  }
  if (typeof durationSec !== "number" || !(durationSec > 0 && durationSec <= MAX_VIDEO_SECONDS)) {
    return `durationSec of ${path}`;
  }
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0) {
    return `bytes of ${path}`;
  }
  return { path, dir, sourceHash, templates, durationSec, bytes };
}

/** Validate a pack's manifest against the declaration it was found through. */
export function parseVideoPackManifest(
  raw: string,
  source: VideoPackSource,
): ReadResult<VideoPackManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return malformed("manifest is not JSON");
  }
  if (!isRecord(parsed)) return malformed("manifest is not an object");
  const { formatVersion, packId, locale, builtAt, pages } = parsed;
  if (formatVersion !== VIDEO_PACK_FORMAT) {
    return { unsupported: true, version: String(formatVersion) };
  }
  if (packId !== source.id) return malformed("packId does not match the declaration");
  if (locale !== source.locale) return malformed("locale does not match the declaration");
  if (typeof builtAt !== "string" || Number.isNaN(Date.parse(builtAt))) return malformed("builtAt");
  if (!Array.isArray(pages)) return malformed("pages");

  const entries: VideoPageEntry[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const entry = parsePage(page);
    if (typeof entry === "string") return malformed(entry);
    if (seen.has(entry.path)) return malformed(`duplicate page ${entry.path}`);
    seen.add(entry.path);
    entries.push(entry);
  }
  return {
    ok: true,
    value: {
      formatVersion: VIDEO_PACK_FORMAT,
      packId: source.id,
      locale: source.locale,
      builtAt,
      pages: entries,
    },
  };
}

/**
 * Is the video still about the page as it is now? `currentEnHash` is the
 * host's bundled docs index hash for the English original; a host that ships
 * newer docs than the pack was built against sees "stale" without the pack
 * being reinstalled.
 */
export function videoFreshness(
  entry: Pick<VideoPageEntry, "sourceHash">,
  currentEnHash: string | undefined,
): VideoFreshness {
  if (currentEnHash === undefined) return "unknown";
  return entry.sourceHash === currentEnHash ? "fresh" : "stale";
}

/** Compare dotted numeric versions (`1.10.0` > `1.9.3`); pre-release tags are ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => (v.split(/[-+]/)[0] ?? "").split(".").map((n) => Number(n) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface VideoCandidate {
  source: VideoPackSource;
  entry: VideoPageEntry;
}

export interface SelectedVideo extends VideoCandidate {
  freshness: VideoFreshness;
  /** Templates this host does not have; non-empty means "update the extension to play this". */
  missingTemplates: string[];
}

const FRESHNESS_RANK: Record<VideoFreshness, number> = { fresh: 2, unknown: 1, stale: 0 };

/**
 * Order the videos covering one page, best first: playable over unplayable,
 * then fresh over stale, then the newer pack, then pack id for a stable order.
 * Callers walk the list so a broken top candidate does not hide a good one.
 */
export function rankVideos<C extends VideoCandidate>(
  candidates: readonly C[],
  currentEnHash: string | undefined,
  knownTemplates: ReadonlySet<string>,
): (C & SelectedVideo)[] {
  const ranked = candidates.map((c) => ({
    ...c,
    freshness: videoFreshness(c.entry, currentEnHash),
    missingTemplates: c.entry.templates.filter((t) => !knownTemplates.has(t)),
  }));
  return ranked.sort(
    (a, b) =>
      Number(a.missingTemplates.length > 0) - Number(b.missingTemplates.length > 0) ||
      FRESHNESS_RANK[b.freshness] - FRESHNESS_RANK[a.freshness] ||
      compareVersions(b.source.version, a.source.version) ||
      a.source.id.localeCompare(b.source.id),
  );
}

/** The best video for a page per {@link rankVideos}, or null when none covers it. */
export function selectVideo<C extends VideoCandidate>(
  candidates: readonly C[],
  currentEnHash: string | undefined,
  knownTemplates: ReadonlySet<string>,
): (C & SelectedVideo) | null {
  return rankVideos(candidates, currentEnHash, knownTemplates)[0] ?? null;
}

/** Budget breaches in a pack, for the pack build to fail on. Empty when within budget. */
export function packBudgetViolations(manifest: Pick<VideoPackManifest, "pages">): string[] {
  const violations = manifest.pages
    .filter((p) => p.bytes > PAGE_BUDGET_BYTES)
    .map((p) => `${p.path}: ${p.bytes} bytes > ${PAGE_BUDGET_BYTES}`);
  const total = manifest.pages.reduce((sum, p) => sum + p.bytes, 0);
  if (total > PACK_BUDGET_BYTES)
    violations.push(`pack total: ${total} bytes > ${PACK_BUDGET_BYTES}`);
  return violations;
}
