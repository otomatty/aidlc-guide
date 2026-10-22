/**
 * The release ids aidlc-workflows writes into its install tree, stamps, and
 * `.aidlc-version`: stable `x.y.z` and preview `<x.y.(z+1)>-preview.<YYYYMMDD>.<N>`.
 * Mirrors upstream `aidlc-channel.ts` so a machine or project on the preview
 * channel is read as a version, never as a broken file.
 */

const NUMBER = "(0|[1-9]\\d*)";
const RELEASE_ID = new RegExp(
  `^${NUMBER}\\.${NUMBER}\\.${NUMBER}(?:-preview\\.(\\d{8})\\.([1-9]\\d*))?$`,
);

/** Upstream bounds untrusted ids before parsing them. */
const MAX_LENGTH = 84;

export type ReleaseId = {
  major: number;
  minor: number;
  patch: number;
  /** Build date and counter of a preview; null for a stable release. */
  preview: { date: string; build: number } | null;
};

export function parseReleaseId(value: string): ReleaseId | null {
  if (value.length > MAX_LENGTH) return null;
  const match = RELEASE_ID.exec(value);
  if (match === null) return null;
  const [, major, minor, patch, date, build] = match;
  const numbers = [major, minor, patch, build].filter((part) => part !== undefined).map(Number);
  if (!numbers.every(Number.isSafeInteger)) return null;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    preview: date === undefined ? null : { date, build: Number(build) },
  };
}

export function isReleaseId(value: string): boolean {
  return parseReleaseId(value) !== null;
}

export function isPreviewRelease(value: string): boolean {
  return parseReleaseId(value)?.preview != null;
}

/**
 * Upstream's total order: numeric on x.y.z; at an equal base a stable release
 * sorts after its previews, and previews order by build date, then counter.
 */
export function compareReleaseIds(left: ReleaseId, right: ReleaseId): number {
  const base = left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  if (base !== 0) return base;
  if (left.preview === null || right.preview === null)
    return (left.preview === null ? 1 : 0) - (right.preview === null ? 1 : 0);
  if (left.preview.date !== right.preview.date)
    return left.preview.date < right.preview.date ? -1 : 1;
  return left.preview.build - right.preview.build;
}
