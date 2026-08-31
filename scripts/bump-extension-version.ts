#!/usr/bin/env bun
/**
 * Decide and apply the vscode-extension semver bump for a merge to main.
 *
 * Usage:
 *   bun scripts/bump-extension-version.ts decide --labels <csv> --current <ver> --previous <ver>
 *   bun scripts/bump-extension-version.ts apply --manifest <package.json> --level <major|minor|patch>
 *   bun scripts/bump-extension-version.ts apply --manifest <package.json> --version <ver>
 *
 * Every merge to main releases. The release labels only choose the SIZE of the
 * bump; a merge that carries none takes DEFAULT_BUMP_LEVEL (patch), so shipping
 * is the default and not-shipping is the thing you have to ask for
 * (`release:skip`).
 *
 * `decide` is the merge-time gate (which level, and did the PR already bump?).
 * `apply --level` re-reads the file so two merges that land back-to-back each
 * increment latest main, rather than both writing the same precomputed version.
 */
import { readFileSync, writeFileSync } from "node:fs";

export const RELEASE_LABELS = {
  "release:major": "major",
  "release:minor": "minor",
  "release:patch": "patch",
} as const;

/** Opt out of the release for a merge that must not ship a VSIX. */
export const SKIP_LABEL = "release:skip";

export type BumpLevel = (typeof RELEASE_LABELS)[keyof typeof RELEASE_LABELS];

/** Level used by a merge that named none. Shipping is the default. */
export const DEFAULT_BUMP_LEVEL: BumpLevel = "patch";

export type ExtensionVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
};

export type LabelResolution =
  | { kind: "none" }
  | { kind: "skip" }
  | { kind: "level"; level: BumpLevel }
  | { kind: "conflict"; labels: string[] };

export type DecideResult =
  | { action: "skip"; reason: "skip-label" }
  | { action: "skip"; reason: "already-bumped"; previous: string; current: string }
  | { action: "bump"; level: BumpLevel; from: string; source: "label" | "default" }
  | { action: "conflict"; labels: string[] }
  | { action: "invalid-version"; version: string };

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const BUMP_LEVELS = new Set<BumpLevel>(["major", "minor", "patch"]);

export function parseExtensionVersion(input: string): ExtensionVersion | null {
  const match = SEMVER_RE.exec(input);
  if (match === null) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? "",
  };
}

export function resolveReleaseLabels(labels: readonly string[]): LabelResolution {
  const unique = [...new Set(labels)];
  const skipped = unique.filter((label) => label === SKIP_LABEL);
  const found = unique
    .filter((label): label is keyof typeof RELEASE_LABELS => Object.hasOwn(RELEASE_LABELS, label))
    .sort();
  // release:skip alongside a level label is a contradiction, not a precedence
  // question: fail closed rather than guess which one the author meant.
  if (skipped.length !== 0 && found.length !== 0) {
    return { kind: "conflict", labels: [...found, SKIP_LABEL].sort() };
  }
  if (skipped.length !== 0) return { kind: "skip" };
  if (found.length === 0) return { kind: "none" };
  if (found.length !== 1) return { kind: "conflict", labels: found };
  const first = found[0];
  if (first === undefined) return { kind: "none" };
  return { kind: "level", level: RELEASE_LABELS[first] };
}

/**
 * node-semver `inc` for major/minor/patch: a prerelease of the version that
 * increment would produce is graduated (1.0.0-rc.1 + major → 1.0.0), otherwise
 * the numeric field bumps and prerelease is stripped.
 */
export function bumpVersion(current: string, level: BumpLevel): string {
  const parsed = parseExtensionVersion(current);
  if (parsed === null) {
    throw new Error(`invalid extension version: ${current}`);
  }
  const next = { ...parsed, prerelease: "" };
  switch (level) {
    case "major":
      if (parsed.minor !== 0 || parsed.patch !== 0 || parsed.prerelease === "") {
        next.major += 1;
      }
      next.minor = 0;
      next.patch = 0;
      break;
    case "minor":
      if (parsed.patch !== 0 || parsed.prerelease === "") {
        next.minor += 1;
      }
      next.patch = 0;
      break;
    case "patch":
      if (parsed.prerelease === "") {
        next.patch += 1;
      }
      break;
    default: {
      const exhaustive: never = level;
      throw new Error(`unhandled bump level: ${exhaustive}`);
    }
  }
  return `${next.major}.${next.minor}.${next.patch}`;
}

export function decideExtensionBump(input: {
  labels: readonly string[];
  current: string;
  previous: string;
}): DecideResult {
  if (parseExtensionVersion(input.current) === null) {
    return { action: "invalid-version", version: input.current };
  }
  if (input.previous !== input.current) {
    return {
      action: "skip",
      reason: "already-bumped",
      previous: input.previous,
      current: input.current,
    };
  }
  const labels = resolveReleaseLabels(input.labels);
  switch (labels.kind) {
    case "none":
      // No label named a size, so ship the smallest one. A merge that must not
      // release says so with release:skip.
      return {
        action: "bump",
        level: DEFAULT_BUMP_LEVEL,
        from: input.current,
        source: "default",
      };
    case "skip":
      return { action: "skip", reason: "skip-label" };
    case "conflict":
      return { action: "conflict", labels: labels.labels };
    case "level":
      return { action: "bump", level: labels.level, from: input.current, source: "label" };
    default: {
      const exhaustive: never = labels;
      throw new Error(`unhandled label resolution: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function formatDecideOutput(result: DecideResult): string[] {
  switch (result.action) {
    case "skip":
      if (result.reason === "already-bumped") {
        return [
          "action=skip",
          "reason=already-bumped",
          `previous=${result.previous}`,
          `current=${result.current}`,
        ];
      }
      return ["action=skip", `reason=${result.reason}`];
    case "bump":
      return [
        "action=bump",
        `level=${result.level}`,
        `from=${result.from}`,
        `source=${result.source}`,
      ];
    case "conflict":
      return ["action=conflict", `labels=${result.labels.join(",")}`];
    case "invalid-version":
      return ["action=invalid-version", `version=${result.version}`];
    default: {
      const exhaustive: never = result;
      throw new Error(`unhandled decide result: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function applyManifestVersion(jsonText: string, version: string): string {
  if (parseExtensionVersion(version) === null) {
    throw new Error(`invalid extension version: ${version}`);
  }
  const parsed: unknown = JSON.parse(jsonText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("extension manifest must be a JSON object");
  }
  const manifest = parsed as Record<string, unknown>;
  manifest.version = version;
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function applyManifestBump(
  jsonText: string,
  spec: { level: BumpLevel } | { version: string },
): { next: string; text: string } {
  const parsed: unknown = JSON.parse(jsonText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("extension manifest must be a JSON object");
  }
  const current = (parsed as { version?: unknown }).version;
  if (typeof current !== "string") {
    throw new Error("extension manifest is missing a string version");
  }
  const next = "level" in spec ? bumpVersion(current, spec.level) : spec.version;
  return { next, text: applyManifestVersion(jsonText, next) };
}

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

const USAGE = `Usage:
  bun scripts/bump-extension-version.ts decide --labels <csv> --current <ver> --previous <ver>
  bun scripts/bump-extension-version.ts apply --manifest <package.json> --level <major|minor|patch>
  bun scripts/bump-extension-version.ts apply --manifest <package.json> --version <ver>
`;

function flagValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  const value = argv[idx + 1];
  if (value === undefined || value.startsWith("-")) throw new UsageError();
  return value;
}

function parseLabelsCsv(raw: string): string[] {
  if (raw === "") return [];
  return raw
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label !== "");
}

function parseLevel(raw: string): BumpLevel {
  if (!BUMP_LEVELS.has(raw as BumpLevel)) throw new UsageError();
  return raw as BumpLevel;
}

export function runCli(argv: string[]): { status: number; stdout: string; stderr: string } {
  try {
    return runCliUnguarded(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      return { status: 1, stdout: "", stderr: USAGE };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { status: 1, stdout: "", stderr: `${message}\n` };
  }
}

function runCliUnguarded(argv: string[]): { status: number; stdout: string; stderr: string } {
  const command = argv[0];
  switch (command) {
    case "decide": {
      const labels = flagValue(argv, "--labels");
      const current = flagValue(argv, "--current");
      const previous = flagValue(argv, "--previous");
      if (labels === undefined || current === undefined || previous === undefined) {
        throw new UsageError();
      }
      const result = decideExtensionBump({
        labels: parseLabelsCsv(labels),
        current,
        previous,
      });
      const lines = formatDecideOutput(result);
      const failing = result.action === "conflict" || result.action === "invalid-version";
      return {
        status: failing ? 1 : 0,
        stdout: `${lines.join("\n")}\n`,
        stderr: failing ? `${lines.join(" ")}\n` : "",
      };
    }
    case "apply": {
      const manifest = flagValue(argv, "--manifest");
      const levelRaw = flagValue(argv, "--level");
      const version = flagValue(argv, "--version");
      if (manifest === undefined || (levelRaw === undefined) === (version === undefined)) {
        throw new UsageError();
      }
      const spec =
        levelRaw !== undefined ? { level: parseLevel(levelRaw) } : { version: version as string };
      const currentText = readFileSync(manifest, "utf8");
      const applied = applyManifestBump(currentText, spec);
      writeFileSync(manifest, applied.text);
      return { status: 0, stdout: `${applied.next}\n`, stderr: "" };
    }
    default:
      throw new UsageError();
  }
}

if (import.meta.main) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  process.exit(result.status);
}
