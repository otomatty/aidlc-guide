/**
 * Doc video wire contract, shared by the video pack validator (official-docs),
 * the host API (api-core) and the renderer (kamishibai, dashboard).
 */

/**
 * Scene templates this build can render. A pack whose storyboard names a
 * template outside this list is offered with an "update the extension" notice
 * instead of being played. The renderer registers exactly these (tested).
 */
export const DOC_VIDEO_TEMPLATES = ["title", "points", "flow"] as const;

export type DocVideoTemplate = (typeof DOC_VIDEO_TEMPLATES)[number];

export type DocVideoFreshness = "fresh" | "stale" | "unknown";

/** `GET /api/official-docs/:locale/videos/<docPath>` value. */
export type DocVideoPayload =
  | {
      status: "none";
      /** Packs installed for this locale — 0 means "offer the pack", more means "no video for this page". */
      packs: number;
    }
  | {
      status: "available";
      packId: string;
      packVersion: string;
      /** "stale": the page changed after the script was written. */
      freshness: DocVideoFreshness;
      /** Templates this build cannot draw; non-empty means "update the extension to play". */
      missingTemplates: string[];
      durationSec: number;
      /** Validated by the renderer (kamishibai `parseStoryboard`), which owns the schema. */
      storyboard: unknown;
      timeline: unknown;
      /** Loadable narration URL for this transport; null where the host cannot serve pack files. */
      narrationUrl: string | null;
    };
