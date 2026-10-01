import {
  findPageVideo,
  type InstalledVideoPack,
  isLocale,
  type Locale,
  listToc,
  type Manifest,
  mapStageToDoc,
  type ResolvedPage,
  readManifest,
  resolvePage,
  type StageDocRef,
  type TocTree,
} from "@aidlc-guide/official-docs";
import {
  DOC_VIDEO_TEMPLATES,
  type DocVideoPayload,
  type ReadResult,
} from "@aidlc-guide/shared-types";

/**
 * `/api/official-docs/*` — distinct from `/api/guides` and `/api/docs-settings` (FR-U2.6).
 */

export function officialDocsManifest(workspaceRoot: string): Promise<ReadResult<Manifest>> {
  return readManifest(workspaceRoot);
}

export function officialDocsToc(
  workspaceRoot: string,
  locale: string,
): Promise<ReadResult<TocTree>> {
  return listToc(workspaceRoot, locale as Locale);
}

export function officialDocsPage(
  workspaceRoot: string,
  locale: string,
  docPath: string,
  anchor?: string,
): Promise<ReadResult<ResolvedPage>> {
  return resolvePage({ workspaceRoot, locale, path: docPath, anchor });
}

export function officialDocsStageMap(stageSlug: string): ReadResult<StageDocRef | null> {
  return { ok: true, value: mapStageToDoc(stageSlug) };
}

const KNOWN_TEMPLATES: ReadonlySet<string> = new Set(DOC_VIDEO_TEMPLATES);

/**
 * `/api/official-docs/:locale/videos/<docPath>` — the explainer video for a page.
 * Fail-soft: a host without pack support, or a page without a video, answers
 * `status: "none"`; `mediaUrl` absent (no way to serve pack files on this
 * transport) leaves `narrationUrl` null rather than leaking a filesystem path.
 */
export async function officialDocsVideo(
  officialDocsRoot: string,
  locale: string,
  docPath: string,
  packs: readonly InstalledVideoPack[],
  mediaUrl: ((absPath: string) => string) | undefined,
): Promise<ReadResult<DocVideoPayload>> {
  if (!isLocale(locale)) return { error: true, reason: "path_rejected" };
  const lookup = await findPageVideo({
    officialDocsRoot,
    locale,
    docPath,
    packs,
    knownTemplates: KNOWN_TEMPLATES,
  });
  if (!("ok" in lookup)) return lookup;
  if (!lookup.value.found)
    return { ok: true, value: { status: "none", packs: lookup.value.packs } };
  const { video } = lookup.value;
  return {
    ok: true,
    value: {
      status: "available",
      packId: video.source.id,
      packVersion: video.source.version,
      freshness: video.freshness,
      missingTemplates: video.missingTemplates,
      durationSec: video.entry.durationSec,
      storyboard: video.storyboard,
      timeline: video.timeline,
      narrationUrl: mediaUrl === undefined ? null : mediaUrl(video.narrationPath),
    },
  };
}
