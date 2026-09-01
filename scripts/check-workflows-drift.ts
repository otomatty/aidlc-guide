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
 * It is deliberately ADVISORY and never writes to the workspace. Four things
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
 *   - `packages/official-docs/src/stage-map.ts` — the seven stage slugs that
 *     deep-link into the bundled docs.
 *
 * The exit status is 0 whenever the check itself ran. Findings are data, not
 * failures: the sync job puts them in the PR body and lets the release label
 * (not this script) decide whether the pin may ship.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
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
 * Agent keys this repository owns. `orchestrator` is not an upstream persona
 * file — it is the `/aidlc` session itself, which the Bridge still has to
 * explain to a beginner — so it must not read as an agent upstream deleted.
 */
export const LOCAL_ONLY_AGENTS: ReadonlySet<string> = new Set(["orchestrator"]);

const STATE_VERSION_RE = /export\s+const\s+CURRENT_STATE_VERSION\s*=\s*(["'])(\d+)\1/;
const WORKSPACE_CURRENT_RE = /export\s+const\s+CURRENT_STATE_VERSION\s*=\s*(\d+)/;
const WORKSPACE_SUPPORTED_RE = /export\s+const\s+SUPPORTED_STATE_VERSIONS\s*=\s*\[([^\]]*)\]/;
const DATA_LINT_COUNT_RE = /expect\(stageEntries\)\s*\.toHaveLength\(\s*(\d+)\s*\)/;

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
};

/** Upstream's `CURRENT_STATE_VERSION` is a *string* literal; ours is a number. */
export function parseUpstreamStateVersion(source: string): number | null {
  const raw = STATE_VERSION_RE.exec(source)?.[2];
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

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
  for (const phase of readdirSync(root)) {
    const dir = path.join(root, phase);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".md")) slugs.push(file.slice(0, -".md".length));
    }
  }
  return [...new Set(slugs)].sort((a, b) => a.localeCompare(b));
}

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
  };
}

function list(values: readonly string[]): string {
  return values.map((value) => `\`${value}\``).join(", ");
}

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
      action: `\`${BRIDGE_MAP_REL}\` に日本語の解説エントリ（purpose / inputs / outputs / agent / gateRequirement / docPath / docAnchor）を追加する。`,
    });
  }
  if (stages.removed.length > 0) {
    findings.push({
      id: "stages-removed",
      severity: "advisory",
      title: `upstream から消えたステージ ${stages.removed.length} 件`,
      detail: list(stages.removed),
      action: `\`${BRIDGE_MAP_REL}\` の該当エントリを削除する（残すと docPath が解決できず data-lint が落ちる）。`,
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
