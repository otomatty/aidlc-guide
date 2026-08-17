/** GitHub Releases lookup for the sideloaded AIDLC Guide VSIX. */

export const RELEASES_LATEST_URL =
  "https://api.github.com/repos/otomatty/aidlc-guide/releases/latest";

export const UPDATE_USER_AGENT = "aidlc-guide";

export const RELEASE_FETCH_TIMEOUT_MS = 15_000;
export const VSIX_FETCH_TIMEOUT_MS = 60_000;

const TAG_RE = /^[vV]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export type Semver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
};

export type LatestRelease = {
  /** Semver without a leading `v`, e.g. `0.2.0`. */
  version: string;
  /** Published git tag, e.g. `v0.2.0`. */
  tag: string;
  assetName: string;
};

export type ReleaseParseError =
  | "invalid-json"
  | "invalid-tag"
  | "missing-asset"
  | "draft-or-prerelease";

export type ReleaseParseResult =
  | { ok: true; value: LatestRelease }
  | { ok: false; reason: ReleaseParseError };

export type UpdateDecision =
  | { kind: "up-to-date"; current: string; latest: string }
  | { kind: "available"; current: string; latest: LatestRelease }
  | { kind: "invalid-current"; current: string };

export function parseSemver(input: string): Semver | null {
  const raw = stripVersionPrefix(input);
  const match = SEMVER_RE.exec(raw);
  if (match === null) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? "",
  };
}

export function compareSemver(left: Semver, right: Semver): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === "") return 1;
  if (right.prerelease === "") return -1;
  return left.prerelease < right.prerelease ? -1 : 1;
}

export function vsixAssetName(version: string): string {
  return `aidlc-guide-${version}.vsix`;
}

export function vsixDownloadUrl(release: LatestRelease): string {
  return `https://github.com/otomatty/aidlc-guide/releases/download/${release.tag}/${release.assetName}`;
}

export function isVsixBuffer(bytes: Uint8Array): boolean {
  return bytes.length >= 100 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function parseLatestRelease(body: unknown): ReleaseParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "invalid-json" };
  }
  const record = body as Record<string, unknown>;
  if (record.draft === true || record.prerelease === true) {
    return { ok: false, reason: "draft-or-prerelease" };
  }
  const parsedTag = parseReleaseTag(record.tag_name);
  if (parsedTag === null) {
    return { ok: false, reason: "invalid-tag" };
  }
  if (!Array.isArray(record.assets)) {
    return { ok: false, reason: "missing-asset" };
  }
  const expected = vsixAssetName(parsedTag.version);
  const hasAsset = record.assets.some(
    (asset) =>
      typeof asset === "object" &&
      asset !== null &&
      (asset as Record<string, unknown>).name === expected,
  );
  if (!hasAsset) {
    return { ok: false, reason: "missing-asset" };
  }
  return {
    ok: true,
    value: {
      version: parsedTag.version,
      tag: parsedTag.tag,
      assetName: expected,
    },
  };
}

export function decideUpdate(current: string, latest: LatestRelease): UpdateDecision {
  const currentSemver = parseSemver(current);
  if (currentSemver === null) {
    return { kind: "invalid-current", current };
  }
  const latestSemver = parseSemver(latest.version);
  if (latestSemver === null) {
    return { kind: "invalid-current", current };
  }
  if (compareSemver(latestSemver, currentSemver) > 0) {
    return { kind: "available", current, latest };
  }
  return { kind: "up-to-date", current, latest: latest.version };
}

function parseReleaseTag(tag: unknown): { tag: string; version: string } | null {
  if (typeof tag !== "string" || !TAG_RE.test(tag)) return null;
  const version = stripVersionPrefix(tag);
  if (parseSemver(version) === null) return null;
  return { tag, version };
}

function stripVersionPrefix(input: string): string {
  return input.startsWith("v") || input.startsWith("V") ? input.slice(1) : input;
}
