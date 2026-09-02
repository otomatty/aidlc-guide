#!/usr/bin/env bun
/**
 * Report what an upstream aidlc-workflows revision would break in this
 * repository, beyond the docs snapshot the mirror already handles.
 *
 * Usage:
 *   bun scripts/check-workflows-drift.ts --upstream <checkout>
 *     [--workspace <root>] [--out <markdown file>]
 *
 * Like `sync-official-docs.ts` this does no network I/O: `--upstream` is a
 * checkout someone else fetched, so the whole check is a pure filesystem
 * operation.
 *
 * It is deliberately ADVISORY and never writes to the workspace. Several things
 * in this repository are pinned to a framework revision by hand, and nothing
 * told a reviewer when they went stale:
 *
 *   - `packages/shared-types/src/index.ts` — the State Version the reader
 *     parser accepts. This is the one finding that is *blocking*: shipping a
 *     release whose parser rejects the framework's own state file leaves every
 *     installed extension showing "unsupported".
 *   - `packages/docs-bridge/data/bridge-map.json` — one hand-written Japanese
 *     entry per stage. A stage upstream added has no entry; one it removed
 *     leaves a dead one, and `tests/data-lint.test.ts` pins the count.
 *   - `packages/docs-bridge/data/agent-map.json` — the same, per agent.
 *   - `packages/docs-bridge/data/artifact-map.json` — the per-artifact
 *     descriptions. Derived, not written: `sync-official-docs.ts` regenerates it
 *     and `tests/artifact-map.test.ts` fails when it is stale, so a stage change
 *     needs a regeneration rather than an edit.
 *   - `packages/official-docs/src/stage-map.ts` — the seven stage slugs that
 *     deep-link into the bundled docs.
 *   - `README.md` — the supported-version declaration a reader of this
 *     repository takes as the answer to "which aidlc-workflows does this
 *     extension target?".
 *
 * The exit status is 0 whenever the check itself ran. Findings are data, not
 * failures: the sync job puts them in the PR body and lets the release label
 * (not this script) decide whether the pin may ship.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inlineCode } from "../packages/official-docs/src/diff-report.ts";
import { MAPPED_STAGE_SLUGS } from "../packages/official-docs/src/stage-map.ts";
import { parseAidlcVersion } from "./sync-official-docs.ts";

/** Where upstream records the framework version, relative to the checkout root. */
const UPSTREAM_VERSION_REL = path.join("dist", "claude", ".claude", "tools", "aidlc-version.ts");

/** Where upstream declares the state-file schema version it writes and accepts. */
const UPSTREAM_LIB_REL = path.join("dist", "claude", ".claude", "tools", "aidlc-lib.ts");

/** One markdown file per stage, grouped into a directory per phase. */
const UPSTREAM_STAGES_REL = path.join("dist", "claude", ".claude", "aidlc-common", "stages");

/** One markdown file per agent persona. */
const UPSTREAM_AGENTS_REL = path.join("dist", "claude", ".claude", "agents");

const SHARED_TYPES_REL = path.join("packages", "shared-types", "src", "index.ts");
const BRIDGE_MAP_REL = path.join("packages", "docs-bridge", "data", "bridge-map.json");
const AGENT_MAP_REL = path.join("packages", "docs-bridge", "data", "agent-map.json");
const DATA_LINT_REL = path.join("packages", "docs-bridge", "tests", "data-lint.test.ts");

/**
 * Repo-authored, NOT a copy of upstream's `dist/cursor/AGENTS.md` — so the
 * shell mirror deliberately leaves it alone. Its opening paragraph still
 * declares the framework version, the State Version and the stage count in
 * prose, and that is what every agent session reads as ground truth. Nothing
 * updated it, so it is checked here rather than mirrored.
 */
const AGENTS_MD_REL = "AGENTS.md";

/**
 * Agent keys this repository owns. `orchestrator` is not an upstream persona
 * file — it is the `/aidlc` session itself, which the Bridge still has to
 * explain to a beginner — so it must not read as an agent upstream deleted.
 */
export const LOCAL_ONLY_AGENTS: ReadonlySet<string> = new Set(["orchestrator"]);

const STATE_VERSION_RE = /export\s+const\s+CURRENT_STATE_VERSION\s*=\s*(["'])(\d+)\1/;
const WORKSPACE_CURRENT_RE = /export\s+const\s+CURRENT_STATE_VERSION\s*=\s*(\d+)/;
const WORKSPACE_SUPPORTED_RE = /export\s+const\s+SUPPORTED_STATE_VERSIONS\s*=\s*\[([^\]]*)\]/;
const DATA_LINT_COUNT_RE = /expect\(stageEntries\)\s*\.toHaveLength\(\s*(\d+)\s*\)/;

/**
 * Also repo-authored, and the first thing a human (or an agent asked to bring
 * this repository up to a new framework revision) reads. It carried the
 * supported version in prose with nothing checking it, and drifted six minor
 * versions behind the pin before anyone noticed. Checked here for the same
 * reason as `AGENTS.md`: the docs mirror cannot fix a file upstream does not
 * own.
 */
const README_REL = "README.md";

// Prose, so each fact is matched on its own rather than as one sentence
// shape: a reworded paragraph should still be checked, not silently skipped.
const AGENTS_VERSION_RE = /AI-DLC Workflows\s+\*{0,2}(\d+\.\d+\.\d+)/;
const AGENTS_STATE_VERSION_RE = /State Version\s+\*{0,2}(\d+)/;
const AGENTS_STAGES_RE = /\*{0,2}(\d+)\*{0,2}\s+stages/;

/**
 * The one README line that states the pin outright. Anchored on the phrase
 * rather than a line number or an HTML comment: a marker nobody can see is a
 * marker the next editor deletes, and this line is meant to be read.
 *
 * The line must BEGIN with the bolded phrase. Matching it anywhere on a line
 * also matched the README's own table row describing this check, which carries
 * no version -- so deleting the real declaration left the check reading that
 * row, reporting a stale pin instead of the missing declaration it should have.
 */
const README_DECLARATION_RE = /^\*\*対応 aidlc-workflows バージョン.*$/m;
/**
 * Every `aidlc-workflows <semver>` mention anywhere in the README. The
 * declaration alone is not enough: the version was also stated in the opening
 * summary and in the prerequisites list, and all three drifted together. The
 * State Version and stage count are deliberately NOT scanned file-wide -- the
 * prerequisites legitimately name State Version 7 as read-compatible, so a
 * whole-file scan for those two would report a stale pin that is not one.
 */
const README_VERSION_RE = /aidlc-workflows\s*\*{0,2}(\d+\.\d+\.\d+)/g;

export type Severity = "blocking" | "advisory";

export type DriftFinding = {
  /** Stable id, so a workflow can key off one finding without matching prose. */
  id: string;
  severity: Severity;
  title: string;
  /** What is out of step, in numbers or names. */
  detail: string;
  /** What a human has to change to close it. */
  action: string;
};

export type UpstreamFacts = {
  version: string;
  stateVersion: number;
  stages: string[];
  agents: string[];
};

export type WorkspaceFacts = {
  currentStateVersion: number;
  supportedStateVersions: number[];
  bridgeStages: string[];
  bridgeSourceVersion: string | null;
  agents: string[];
  agentSourceVersion: string | null;
  mappedStageSlugs: string[];
  dataLintStageCount: number | null;
  /** What `AGENTS.md` tells an agent session it is operating on. */
  agentsDeclaration: AgentsDeclaration;
  /** What `README.md` tells a reader this repository supports. */
  readmeDeclaration: ReadmeDeclaration;
};

/** Upstream's `CURRENT_STATE_VERSION` is a *string* literal; ours is a number. */
export function parseUpstreamStateVersion(source: string): number | null {
  const raw = STATE_VERSION_RE.exec(source)?.[2];
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * This repository's own constants, which are numeric and plural: one current
 * version plus the set the reader parser still accepts. Returns null rather
 * than a partial reading -- a half-parsed set would silently narrow what the
 * check thinks is supported.
 */
export function parseWorkspaceStateVersions(
  source: string,
): { current: number; supported: number[] } | null {
  const currentRaw = WORKSPACE_CURRENT_RE.exec(source)?.[1];
  const supportedRaw = WORKSPACE_SUPPORTED_RE.exec(source)?.[1];
  if (currentRaw === undefined || supportedRaw === undefined) return null;
  const current = Number(currentRaw);
  if (!Number.isSafeInteger(current)) return null;
  const supported: number[] = [];
  for (const piece of supportedRaw.split(",")) {
    const trimmed = piece.trim();
    if (trimmed === "") continue;
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) return null;
    supported.push(value);
  }
  if (supported.length === 0) return null;
  return { current, supported: [...supported].sort((a, b) => a - b) };
}

/**
 * The stage count `packages/docs-bridge/tests/data-lint.test.ts` pins. Matched
 * on `stageEntries` specifically, so the sibling assertion on `termEntries`
 * cannot be picked up by mistake.
 */
export type AgentsDeclaration = {
  version: string | null;
  stateVersion: number | null;
  stages: number | null;
};

/**
 * The three facts `AGENTS.md` states in prose. Each is independent: a missing
 * one reads as "not declared" and is simply not checked, so a rewording that
 * drops one fact never turns into a false finding about it.
 */
export function parseAgentsDeclaration(source: string): AgentsDeclaration {
  const number = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  };
  return {
    version: AGENTS_VERSION_RE.exec(source)?.[1] ?? null,
    stateVersion: number(AGENTS_STATE_VERSION_RE.exec(source)?.[1]),
    stages: number(AGENTS_STAGES_RE.exec(source)?.[1]),
  };
}

export type ReadmeDeclaration = {
  /** False when the README states no supported version at all. */
  declared: boolean;
  version: string | null;
  stateVersion: number | null;
  stages: number | null;
  /**
   * Every version named OUTSIDE the declaration line, distinct and sorted so
   * the finding reads the same on every run. Compared against upstream by the
   * caller rather than against the declaration: what matters is whether the
   * README's prose matches the framework, and a declaration that states no
   * version of its own has nothing to compare against.
   */
  otherVersions: string[];
};

/**
 * What `README.md` claims about the framework revision it targets. Unlike
 * `parseAgentsDeclaration`, a MISSING declaration is reported rather than
 * skipped: this check exists because the README's version claim went unchecked
 * for six minor versions, and a rewording that drops the line would otherwise
 * silently switch the check off again.
 */
export function parseReadmeDeclaration(source: string): ReadmeDeclaration {
  const number = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  };
  const line = README_DECLARATION_RE.exec(source)?.[0] ?? null;
  const version = line === null ? null : (/(\d+\.\d+\.\d+)/.exec(line)?.[1] ?? null);

  const mentioned = new Set<string>();
  for (const sourceLine of source.split("\n")) {
    // The declaration states itself; it is checked field by field above.
    if (line !== null && sourceLine === line) continue;
    // The regex is /g and module-scoped, so lastIndex survives between calls;
    // matchAll resets it for us rather than leaving the next caller to start
    // mid-line.
    for (const match of sourceLine.matchAll(README_VERSION_RE)) {
      const found = match[1];
      if (found !== undefined) mentioned.add(found);
    }
  }

  return {
    declared: line !== null,
    version,
    stateVersion: line === null ? null : number(/State Version\s+\*{0,2}(\d+)/.exec(line)?.[1]),
    stages: line === null ? null : number(/\*{0,2}(\d+)\*{0,2}\s*ステージ/.exec(line)?.[1]),
    otherVersions: [...mentioned].sort((a, b) => a.localeCompare(b)),
  };
}

export function parseDataLintStageCount(source: string): number | null {
  const raw = DATA_LINT_COUNT_RE.exec(source)?.[1];
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** Slugs are file basenames, one level below the phase directories. */
export function readUpstreamStages(upstreamRoot: string): string[] {
  const root = path.join(upstreamRoot, UPSTREAM_STAGES_REL);
  if (!existsSync(root)) return [];
  const slugs: string[] = [];
  // withFileTypes rather than statSync: readdirSync also returns broken
  // symlinks, and statting one throws ENOENT and fails the whole read.
  for (const phase of readdirSync(root, { withFileTypes: true })) {
    if (!phase.isDirectory()) continue;
    const dir = path.join(root, phase.name);
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".md")) slugs.push(file.slice(0, -".md".length));
    }
  }
  return [...new Set(slugs)].sort((a, b) => a.localeCompare(b));
}

/** Slugs are the agent markdown basenames, flat in one directory. */
export function readUpstreamAgents(upstreamRoot: string): string[] {
  const root = path.join(upstreamRoot, UPSTREAM_AGENTS_REL);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))
    .sort((a, b) => a.localeCompare(b));
}

/** `{ added: upstream-only, removed: workspace-only }`. */
export function diffSlugs(
  upstream: readonly string[],
  workspace: readonly string[],
  localOnly: ReadonlySet<string> = new Set(),
): { added: string[]; removed: string[] } {
  const up = new Set(upstream);
  const local = new Set(workspace);
  return {
    added: [...up].filter((slug) => !local.has(slug)).sort((a, b) => a.localeCompare(b)),
    removed: [...local]
      .filter((slug) => !up.has(slug) && !localOnly.has(slug))
      .sort((a, b) => a.localeCompare(b)),
  };
}

/** The `sourceVersion` string both docs-bridge maps are expected to carry. */
export function expectedSourceVersion(version: string, stateVersion: number): string {
  return `aidlc ${version} (State Version ${stateVersion})`;
}

function stringKeys(json: string, field: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const value = (parsed as Record<string, unknown>)[field];
  if (value === null || typeof value !== "object") return null;
  return Object.keys(value as Record<string, unknown>).sort((a, b) => a.localeCompare(b));
}

function sourceVersionOf(json: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const value = (parsed as Record<string, unknown>).sourceVersion;
  return typeof value === "string" ? value : null;
}

/**
 * Everything the check needs from upstream, or a throw naming what was
 * missing. Refusing an empty stage or agent list matters as much as reading
 * the versions: an empty one would otherwise read as "upstream deleted every
 * stage" and fill the PR body with findings that are really a bad checkout.
 */
export function readUpstreamFacts(upstreamRoot: string): UpstreamFacts {
  const versionFile = path.join(upstreamRoot, UPSTREAM_VERSION_REL);
  if (!existsSync(versionFile)) {
    throw new Error(`upstream checkout has no ${UPSTREAM_VERSION_REL} (looked in ${upstreamRoot})`);
  }
  const version = parseAidlcVersion(readFileSync(versionFile, "utf8"));
  if (version === null) throw new Error(`could not read AIDLC_VERSION from ${versionFile}`);

  const libFile = path.join(upstreamRoot, UPSTREAM_LIB_REL);
  if (!existsSync(libFile)) {
    throw new Error(`upstream checkout has no ${UPSTREAM_LIB_REL} (looked in ${upstreamRoot})`);
  }
  const stateVersion = parseUpstreamStateVersion(readFileSync(libFile, "utf8"));
  if (stateVersion === null) {
    throw new Error(`could not read CURRENT_STATE_VERSION from ${libFile}`);
  }

  const stages = readUpstreamStages(upstreamRoot);
  if (stages.length === 0) {
    throw new Error(`upstream checkout has no stage files under ${UPSTREAM_STAGES_REL}`);
  }
  const agents = readUpstreamAgents(upstreamRoot);
  if (agents.length === 0) {
    throw new Error(`upstream checkout has no agent files under ${UPSTREAM_AGENTS_REL}`);
  }
  return { version, stateVersion, stages, agents };
}

/**
 * The same facts as this repository holds them. `mappedStageSlugs` is the
 * exception to `workspaceRoot`: the stage map is compiled code imported here,
 * not data read off disk, so it always describes THIS checkout.
 */
export function readWorkspaceFacts(workspaceRoot: string): WorkspaceFacts {
  const sharedTypesFile = path.join(workspaceRoot, SHARED_TYPES_REL);
  const stateVersions = parseWorkspaceStateVersions(readFileSync(sharedTypesFile, "utf8"));
  if (stateVersions === null) {
    throw new Error(`could not read the State Version constants from ${sharedTypesFile}`);
  }

  const bridgeJson = readFileSync(path.join(workspaceRoot, BRIDGE_MAP_REL), "utf8");
  const bridgeStages = stringKeys(bridgeJson, "stages");
  if (bridgeStages === null) throw new Error(`could not read stages from ${BRIDGE_MAP_REL}`);

  const agentJson = readFileSync(path.join(workspaceRoot, AGENT_MAP_REL), "utf8");
  const agents = stringKeys(agentJson, "agents");
  if (agents === null) throw new Error(`could not read agents from ${AGENT_MAP_REL}`);

  const agentsMdFile = path.join(workspaceRoot, AGENTS_MD_REL);
  const readmeFile = path.join(workspaceRoot, README_REL);
  const dataLintFile = path.join(workspaceRoot, DATA_LINT_REL);
  const dataLintStageCount = existsSync(dataLintFile)
    ? parseDataLintStageCount(readFileSync(dataLintFile, "utf8"))
    : null;

  return {
    currentStateVersion: stateVersions.current,
    supportedStateVersions: stateVersions.supported,
    bridgeStages,
    bridgeSourceVersion: sourceVersionOf(bridgeJson),
    agents,
    agentSourceVersion: sourceVersionOf(agentJson),
    mappedStageSlugs: [...MAPPED_STAGE_SLUGS].sort((a, b) => a.localeCompare(b)),
    dataLintStageCount,
    agentsDeclaration: parseAgentsDeclaration(
      existsSync(agentsMdFile) ? readFileSync(agentsMdFile, "utf8") : "",
    ),
    readmeDeclaration: parseReadmeDeclaration(
      existsSync(readmeFile) ? readFileSync(readmeFile, "utf8") : "",
    ),
  };
}

function list(values: readonly string[]): string {
  // inlineCode, not a bare backtick pair: stage and agent slugs come from
  // upstream filenames, and a backtick in one would close the span early.
  return values.map((value) => inlineCode(value)).join(", ");
}

/**
 * The comparison itself, pure so the whole finding set is testable without a
 * filesystem. Exactly one finding is `blocking` -- see the module docstring
 * for why the State Version is the only one that stops a release.
 */
export function buildFindings(upstream: UpstreamFacts, workspace: WorkspaceFacts): DriftFinding[] {
  const findings: DriftFinding[] = [];

  // Blocking, and the only one that is: the reader parser is what decides
  // whether an installed extension can read a workspace at all, so a pin whose
  // State Version we do not accept must not reach users as a patch release.
  if (!workspace.supportedStateVersions.includes(upstream.stateVersion)) {
    findings.push({
      id: "state-version-unsupported",
      severity: "blocking",
      title: "State Version が拡張のサポート範囲外",
      detail: `upstream は State Version ${upstream.stateVersion}、この拡張が受け付けるのは ${workspace.supportedStateVersions.join(", ")}。`,
      action: `\`${SHARED_TYPES_REL}\` の \`SUPPORTED_STATE_VERSIONS\` / \`CURRENT_STATE_VERSION\` を更新し、\`packages/reader-core/src/parse/\` のパーサを新しいスキーマに追随させる。それまでこの PR はリリースしない。`,
    });
  } else if (workspace.currentStateVersion !== upstream.stateVersion) {
    findings.push({
      id: "state-version-not-current",
      severity: "advisory",
      title: "CURRENT_STATE_VERSION が upstream と一致していない",
      detail: `upstream は ${upstream.stateVersion}、この拡張の CURRENT_STATE_VERSION は ${workspace.currentStateVersion}（サポート範囲内なので読み取りは可能）。`,
      action: `\`${SHARED_TYPES_REL}\` の \`CURRENT_STATE_VERSION\` を ${upstream.stateVersion} に上げる。`,
    });
  }

  const stages = diffSlugs(upstream.stages, workspace.bridgeStages);
  if (stages.added.length > 0) {
    findings.push({
      id: "stages-added",
      severity: "advisory",
      title: `upstream に増えたステージ ${stages.added.length} 件`,
      detail: list(stages.added),
      action: `\`${BRIDGE_MAP_REL}\` に日本語の解説エントリ（purpose / inputs / outputs / agent / gateRequirement / docPath / docAnchor）を追加し、\`bun scripts/build-artifact-map.ts\` で成果物説明を再生成する。`,
    });
  }
  if (stages.removed.length > 0) {
    findings.push({
      id: "stages-removed",
      severity: "advisory",
      title: `upstream から消えたステージ ${stages.removed.length} 件`,
      detail: list(stages.removed),
      action: `\`${BRIDGE_MAP_REL}\` の該当エントリを削除し（残すと docPath が解決できず data-lint が落ちる）、\`bun scripts/build-artifact-map.ts\` で成果物説明を再生成する。`,
    });
  }

  // The count is asserted separately from the entries, so a rename that adds
  // and removes one stage leaves it correct while both findings above fire.
  if (
    workspace.dataLintStageCount !== null &&
    workspace.dataLintStageCount !== upstream.stages.length
  ) {
    findings.push({
      id: "data-lint-stage-count",
      severity: "advisory",
      title: "data-lint のステージ件数が upstream と一致していない",
      detail: `upstream は ${upstream.stages.length} ステージ、\`${DATA_LINT_REL}\` は ${workspace.dataLintStageCount} 件を期待している。`,
      action: `\`${DATA_LINT_REL}\` の \`toHaveLength(${workspace.dataLintStageCount})\` を ${upstream.stages.length} に更新する。`,
    });
  }

  const agents = diffSlugs(upstream.agents, workspace.agents, LOCAL_ONLY_AGENTS);
  if (agents.added.length > 0) {
    findings.push({
      id: "agents-added",
      severity: "advisory",
      title: `upstream に増えたエージェント ${agents.added.length} 件`,
      detail: list(agents.added),
      action: `\`${AGENT_MAP_REL}\` に displayName / description / markdown を追加する。`,
    });
  }
  if (agents.removed.length > 0) {
    findings.push({
      id: "agents-removed",
      severity: "advisory",
      title: `upstream から消えたエージェント ${agents.removed.length} 件`,
      detail: list(agents.removed),
      action: `\`${AGENT_MAP_REL}\` の該当エントリを削除する。`,
    });
  }

  const unknownMapped = workspace.mappedStageSlugs.filter(
    (slug) => !upstream.stages.includes(slug),
  );
  if (unknownMapped.length > 0) {
    findings.push({
      id: "stage-map-unknown",
      severity: "advisory",
      title: `stage-map.ts が upstream に無いステージを指している（${unknownMapped.length} 件）`,
      detail: list(unknownMapped),
      action: `\`packages/official-docs/src/stage-map.ts\` の該当スラッグを、現行のステージ名に貼り替えるか削除する。`,
    });
  }

  // AGENTS.md is prose an agent session reads as ground truth, and the shell
  // mirror cannot fix it: the file is repo-authored, not a copy of upstream's.
  // Left unchecked, a sync PR goes green while every later session is told it
  // is working against a framework version the repository no longer carries.
  const declared = workspace.agentsDeclaration;
  const declaredStale: string[] = [];
  if (declared.version !== null && declared.version !== upstream.version) {
    declaredStale.push(`バージョン ${declared.version} → ${upstream.version}`);
  }
  if (declared.stateVersion !== null && declared.stateVersion !== upstream.stateVersion) {
    declaredStale.push(`State Version ${declared.stateVersion} → ${upstream.stateVersion}`);
  }
  if (declared.stages !== null && declared.stages !== upstream.stages.length) {
    declaredStale.push(`ステージ数 ${declared.stages} → ${upstream.stages.length}`);
  }
  if (declaredStale.length > 0) {
    findings.push({
      id: "agents-md-stale",
      severity: "advisory",
      title: "AGENTS.md の宣言が upstream と一致していない",
      detail: declaredStale.join(" / "),
      action: `\`${AGENTS_MD_REL}\` 冒頭の宣言を書き替える。このファイルは upstream の写しではなくリポジトリ所有なので、シェル同期では直りません。`,
    });
  }

  // README.md is the answer a human gets to "which aidlc-workflows does this
  // repository support?", and an agent asked to raise that version reads it
  // first. Same reasoning as AGENTS.md above -- repo-authored, so neither
  // mirror repairs it -- but the missing case is a finding too, because this
  // check is the only thing standing between the claim and six versions of
  // drift.
  const readme = workspace.readmeDeclaration;
  if (!readme.declared) {
    findings.push({
      id: "readme-declaration-missing",
      severity: "advisory",
      title: "README.md に対応バージョンの宣言が無い",
      detail: `\`${README_REL}\` に「対応 aidlc-workflows バージョン」の行が見つかりません。`,
      action: `\`${README_REL}\` の冒頭に \`**対応 aidlc-workflows バージョン: ${upstream.version}**（State Version **${upstream.stateVersion}** / **${upstream.stages.length}** ステージ）\` の形で宣言行を戻す。この行が無いと以降のピン更新でこのチェックが黙って素通りします。`,
    });
  } else {
    const readmeStale: string[] = [];
    // A null field means the line exists but does not state that fact, and it
    // is reported rather than skipped -- unlike the AGENTS.md check above.
    // Skipping it would leave open exactly the hole the `declared` flag closes:
    // a reword that keeps the phrase and drops the numbers still reads as a
    // declaration to a human while telling this check nothing to compare.
    if (readme.version === null) {
      readmeStale.push(`宣言行にバージョンの記載が無い（${upstream.version}）`);
    } else if (readme.version !== upstream.version) {
      readmeStale.push(`バージョン ${readme.version} → ${upstream.version}`);
    }
    if (readme.stateVersion === null) {
      readmeStale.push(`宣言行に State Version の記載が無い（${upstream.stateVersion}）`);
    } else if (readme.stateVersion !== upstream.stateVersion) {
      readmeStale.push(`State Version ${readme.stateVersion} → ${upstream.stateVersion}`);
    }
    if (readme.stages === null) {
      readmeStale.push(`宣言行にステージ数の記載が無い（${upstream.stages.length}）`);
    } else if (readme.stages !== upstream.stages.length) {
      readmeStale.push(`ステージ数 ${readme.stages} → ${upstream.stages.length}`);
    }
    const strayVersions = readme.otherVersions.filter((found) => found !== upstream.version);
    if (strayVersions.length > 0) {
      readmeStale.push(`宣言行以外に残っている版数 ${list(strayVersions)}`);
    }
    if (readmeStale.length > 0) {
      findings.push({
        id: "readme-stale",
        severity: "advisory",
        title: "README.md の対応バージョンが upstream と一致していない",
        detail: readmeStale.join(" / "),
        action: `\`${README_REL}\` の宣言行を \`**対応 aidlc-workflows バージョン: ${upstream.version}**（State Version **${upstream.stateVersion}** / **${upstream.stages.length}** ステージ）\` の形で 3 項目そろえ、本文中の \`aidlc-workflows <版数>\` の記述も ${upstream.version} に揃える。このファイルは upstream の写しではなくリポジトリ所有なので、どちらの同期でも直りません。`,
      });
    }
  }

  const expected = expectedSourceVersion(upstream.version, upstream.stateVersion);
  const stale: string[] = [];
  if (workspace.bridgeSourceVersion !== expected) stale.push(BRIDGE_MAP_REL);
  if (workspace.agentSourceVersion !== expected) stale.push(AGENT_MAP_REL);
  if (stale.length > 0) {
    findings.push({
      id: "source-version-stale",
      severity: "advisory",
      title: "docs-bridge の sourceVersion が新しいピンを指していない",
      detail: `期待値 \`${expected}\` に対し ${stale
        .map(
          (rel) =>
            `\`${rel}\` = \`${rel === BRIDGE_MAP_REL ? workspace.bridgeSourceVersion : workspace.agentSourceVersion}\``,
        )
        .join(" / ")}。`,
      action: "内容を確認したうえで `sourceVersion` を新しいピンに書き替える。",
    });
  }

  return findings;
}

/**
 * The markdown that rides in the sync PR body: a table of where the two sides
 * stand, then one checklist item per finding. A blocking finding also gets a
 * caution block at the top, because the table alone reads as reassuring.
 */
export function formatDriftSection(input: {
  upstream: UpstreamFacts;
  workspace: WorkspaceFacts;
  findings: readonly DriftFinding[];
}): string {
  const { upstream, workspace, findings } = input;
  const localAgents = workspace.agents.filter((slug) => LOCAL_ONLY_AGENTS.has(slug));
  const lines = [
    "## aidlc-workflows 互換性チェック",
    "",
    "| 項目 | upstream | このリポジトリ |",
    "|------|----------|----------------|",
    `| AIDLC_VERSION | ${upstream.version} | — |`,
    `| State Version | ${upstream.stateVersion} | current ${workspace.currentStateVersion} / supported ${workspace.supportedStateVersions.join(", ")} |`,
    `| ステージ数 | ${upstream.stages.length} | ${workspace.bridgeStages.length} (bridge-map) |`,
    `| エージェント数 | ${upstream.agents.length} | ${workspace.agents.length} (agent-map${
      localAgents.length > 0 ? `、うちローカル所有 ${list(localAgents)}` : ""
    }) |`,
    `| AGENTS.md の宣言 | ${upstream.version} / SV ${upstream.stateVersion} / ${upstream.stages.length} stages | ${workspace.agentsDeclaration.version ?? "—"} / SV ${workspace.agentsDeclaration.stateVersion ?? "—"} / ${workspace.agentsDeclaration.stages ?? "—"} stages |`,
    `| README.md の宣言 | ${upstream.version} / SV ${upstream.stateVersion} / ${upstream.stages.length} ステージ | ${
      workspace.readmeDeclaration.declared
        ? `${workspace.readmeDeclaration.version ?? "—"} / SV ${workspace.readmeDeclaration.stateVersion ?? "—"} / ${workspace.readmeDeclaration.stages ?? "—"} ステージ`
        : "宣言なし"
    } |`,
    "",
  ];

  if (findings.length === 0) {
    lines.push("差分なし — このピンに手作業で追随すべき箇所はありません。");
    return lines.join("\n");
  }

  const blocking = findings.filter((finding) => finding.severity === "blocking");
  if (blocking.length > 0) {
    lines.push(
      `> [!CAUTION]`,
      `> ブロッキングな差分が ${blocking.length} 件あります。解消するまでこの PR はリリースされません（\`release:skip\`）。`,
      "",
    );
  }
  for (const finding of findings) {
    const badge = finding.severity === "blocking" ? "**BLOCKING**" : "advisory";
    lines.push(
      `- [ ] ${badge} — ${finding.title}`,
      `  - ${finding.detail}`,
      `  - 対応: ${finding.action}`,
    );
  }
  return lines.join("\n");
}

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

const USAGE = `Usage:
  bun scripts/check-workflows-drift.ts --upstream <checkout>
    [--workspace <root>] [--out <markdown file>]
`;

function flagValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx < 0) return undefined;
  const value = argv[idx + 1];
  if (value === undefined || value.startsWith("-")) throw new UsageError();
  return value;
}

function run(argv: string[]): string[] {
  const upstream = flagValue(argv, "--upstream");
  if (upstream === undefined) throw new UsageError();
  const workspaceRoot = path.resolve(
    flagValue(argv, "--workspace") ?? path.join(import.meta.dirname, ".."),
  );
  const outPath = flagValue(argv, "--out");

  const upstreamFacts = readUpstreamFacts(path.resolve(upstream));
  const workspaceFacts = readWorkspaceFacts(workspaceRoot);
  const findings = buildFindings(upstreamFacts, workspaceFacts);
  const blocking = findings.filter((finding) => finding.severity === "blocking");

  if (outPath !== undefined) {
    writeFileSync(
      path.resolve(outPath),
      `${formatDriftSection({
        upstream: upstreamFacts,
        workspace: workspaceFacts,
        findings,
      })}\n`,
    );
  }

  return [
    `upstream_version=${upstreamFacts.version}`,
    `upstream_state_version=${upstreamFacts.stateVersion}`,
    `supported_state_versions=${workspaceFacts.supportedStateVersions.join(",")}`,
    // The whole point of the check, in one boolean the workflow can branch on.
    `state_version_supported=${blocking.every((finding) => finding.id !== "state-version-unsupported")}`,
    `findings=${findings.length}`,
    `blocking=${blocking.length}`,
    `drift=${findings.length > 0}`,
    `finding_ids=${findings.map((finding) => finding.id).join(",")}`,
  ];
}

export function runCli(argv: string[]): { status: number; stdout: string; stderr: string } {
  try {
    return { status: 0, stdout: `${run(argv).join("\n")}\n`, stderr: "" };
  } catch (error) {
    if (error instanceof UsageError) return { status: 1, stdout: "", stderr: USAGE };
    const message = error instanceof Error ? error.message : String(error);
    return { status: 1, stdout: "", stderr: `${message}\n` };
  }
}

if (import.meta.main) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  process.exit(result.status);
}
