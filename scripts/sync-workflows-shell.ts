#!/usr/bin/env bun
import { createHash } from "node:crypto";
/**
 * Mirror the upstream aidlc-workflows workspace shell (`dist/claude/.claude`)
 * into this repository's own `.claude/`.
 *
 * Usage:
 *   bun scripts/sync-workflows-shell.ts --upstream <checkout> --upstream-sha <sha>
 *     [--workspace <root>] [--pr-body <file>]
 *
 * Like `sync-official-docs.ts` this does no network I/O: `--upstream` is a
 * checkout someone else fetched, so the whole sync is a pure filesystem
 * operation, testable and re-runnable.
 *
 * WHY THIS IS NOT A USER-VISIBLE RELEASE. `.claude/` is this repository's own
 * AI-DLC workspace, not something the VSIX ships: `.vscodeignore` packages only
 * `dist/` and `media/`, and at runtime `docs-bridge` resolves every `docPath`
 * against the *user's* `docsRepoPath`. What `.claude/` is, is the fixture the
 * gate validates against — `packages/docs-bridge/tests/data-lint.test.ts`
 * resolves all 33 bridge-map entries against `.claude/aidlc-common/stages`. So
 * a stale shell means the gate is checking yesterday's stage graph, which is
 * exactly the drift nobody notices. The sync PR therefore lands as
 * `release:skip` by default; swap the label if you land user-visible work on
 * the branch alongside it.
 *
 * THE MIRROR DELETES. A stage or agent upstream removed has to disappear here
 * too, or the gate keeps passing against a file the framework no longer has.
 * The only exceptions are the paths this repository owns
 * (`LOCAL_ONLY_SHELL_PATHS`) and the gitignored per-user settings. A local edit
 * to any *shared* file is overwritten — deliberately, because a fork of the
 * shell that nobody declared is drift, not customisation — and the PR body
 * names every file it rewrote so the diff is reviewable rather than silent.
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseAidlcVersion, unportablePaths } from "./sync-official-docs.ts";

/** The shell tree inside an upstream checkout. */
const UPSTREAM_SHELL_REL = path.join("dist", "claude", ".claude");

/** Where it lands here. */
export const SHELL_REL = ".claude";

/** Where the framework version sits inside either shell. */
const VERSION_REL = path.join("tools", "aidlc-version.ts");

/**
 * Paths this repository owns inside `.claude/`. They do not exist upstream and
 * must survive the mirror. `aidlc-prd-implementation.md` is this project's own
 * AI-DLC scope; upstream has no such scope and never will.
 */
export const LOCAL_ONLY_SHELL_PATHS: ReadonlySet<string> = new Set([
  "scopes/aidlc-prd-implementation.md",
]);

/**
 * Paths the mirror neither writes nor deletes. `settings.local.json` is the
 * gitignored per-user override the README tells contributors to create; a
 * mirror that deleted it would wipe a developer's local model and env config
 * every time upstream moved.
 */
export const IGNORED_SHELL_PATHS: ReadonlySet<string> = new Set(["settings.local.json"]);

/** Never walked, on either side. */
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

/** C0 controls plus DEL -- never part of a legitimate shell path. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point.
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;

export type ShellPlan = {
  /** Relative POSIX paths to copy from upstream into `.claude/`. */
  writes: string[];
  /** Of those writes, the ones that already exist here with different content. */
  overwrites: string[];
  /** Relative POSIX paths to remove from `.claude/`. */
  deletes: string[];
  /** Paths absent upstream that are kept because this repo owns them. */
  preserved: string[];
};

/**
 * Walk a shell root; return relative POSIX paths → sha256 hex.
 *
 * Unlike the docs walker this keeps dotfiles: `tools/data/templates/.gitkeep`
 * is what holds those directories in git, and skipping it would leave the
 * mirror unable to create them. Symlinks are still never followed — the
 * upstream tree is an external repository, and a symlink into the runner's
 * checkout would otherwise be copied in as a file.
 */
export function walkShellFiles(root: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(root)) return out;
  if (lstatSync(root).isSymbolicLink()) {
    throw new Error(`shell root must not be a symlink: ${root}`);
  }

  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      const abs = path.join(dir, name);
      let st: ReturnType<typeof lstatSync>;
      try {
        st = lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
        continue;
      }
      // Symlinks are neither isFile() nor isDirectory() under lstat, so they
      // fall out here and a directory symlink cannot escape the root.
      if (!st.isFile()) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (rel === "") continue;
      // A control character survives into the PR body, where a newline ends the
      // list item and lets the rest of the path render as its own markdown.
      if (CONTROL_CHAR_RE.test(rel)) {
        throw new Error(`shell path contains a control character: ${JSON.stringify(rel)}`);
      }
      out.set(rel, createHash("sha256").update(readFileSync(abs)).digest("hex"));
    }
  }
  return out;
}

/** Pure: every filesystem decision this script makes is visible here. */
export function planShellSync(
  upstream: ReadonlyMap<string, string>,
  local: ReadonlyMap<string, string>,
  localOnly: ReadonlySet<string> = LOCAL_ONLY_SHELL_PATHS,
  ignored: ReadonlySet<string> = IGNORED_SHELL_PATHS,
): ShellPlan {
  const plan: ShellPlan = { writes: [], overwrites: [], deletes: [], preserved: [] };
  for (const [rel, hash] of upstream) {
    if (ignored.has(rel)) continue;
    // Before the hash comparison, not inside one branch of it: a path this
    // repository owns stays ours even if upstream starts publishing one at the
    // same name. The PR body still reports the collision as preserved.
    if (localOnly.has(rel)) {
      plan.preserved.push(rel);
      continue;
    }
    const current = local.get(rel);
    if (current === hash) continue;
    plan.writes.push(rel);
    if (current !== undefined) plan.overwrites.push(rel);
  }
  for (const rel of local.keys()) {
    if (upstream.has(rel) || ignored.has(rel)) continue;
    if (localOnly.has(rel)) {
      plan.preserved.push(rel);
      continue;
    }
    plan.deletes.push(rel);
  }
  const sort = (values: string[]): string[] =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    writes: sort(plan.writes),
    overwrites: sort(plan.overwrites),
    deletes: sort(plan.deletes),
    preserved: sort(plan.preserved),
  };
}

/** Resolve a relative shell path under a root, refusing anything that escapes it. */
function resolveUnder(root: string, rel: string): string {
  const abs = path.resolve(root, ...rel.split("/"));
  const bounded = path.resolve(root);
  if (abs !== bounded && !abs.startsWith(bounded + path.sep)) {
    throw new Error(`shell path escapes the tree: ${rel}`);
  }
  return abs;
}

export function applyShellSync(input: {
  workspaceRoot: string;
  upstreamShellRoot: string;
  plan: ShellPlan;
}): void {
  const { workspaceRoot, upstreamShellRoot, plan } = input;
  const localRoot = path.join(workspaceRoot, SHELL_REL);
  // Deletions first: upstream can replace a directory `tools/data/` with a file
  // named `data`, which reaches the plan as a write plus the deletions of
  // everything that used to live there. Writing first would hit the stale entry
  // (EISDIR / ENOTDIR) and kill the whole sync on that revision.
  for (const rel of plan.deletes) {
    rmSync(resolveUnder(localRoot, rel), { force: true });
  }
  for (const rel of plan.writes) {
    const dest = resolveUnder(localRoot, rel);
    // Ordering alone does not clear a directory-turned-file: its files are gone
    // but the empty directory still occupies the destination name.
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(resolveUnder(upstreamShellRoot, rel), dest);
  }
}

export function readShellVersion(shellRoot: string): string | null {
  const file = path.join(shellRoot, VERSION_REL);
  if (!existsSync(file)) return null;
  try {
    return parseAidlcVersion(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** At most `limit` entries as inline code, then a count of the rest. */
function capped(values: readonly string[], limit = 20): string {
  if (values.length === 0) return "_(なし)_";
  const shown = values.slice(0, limit).map((value) => `\`${value}\``);
  const rest = values.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} ほか ${rest} 件` : shown.join(", ");
}

export function formatShellPrBody(input: {
  version: string;
  previousVersion: string | null;
  upstreamSha: string;
  upstreamBranch: string;
  plan: ShellPlan;
}): string {
  const { version, previousVersion, upstreamSha, upstreamBranch, plan } = input;
  return [
    `Automated mirror of [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) \`${upstreamBranch}\` の \`dist/claude/.claude\`（ワークスペースシェル）。`,
    "",
    "| Field | Previous | New |",
    "|-------|----------|-----|",
    `| AIDLC_VERSION | ${previousVersion ?? "_(none)_"} | ${version} |`,
    `| UPSTREAM_SHA | — | \`${upstreamSha}\` |`,
    "",
    `Changelog: https://github.com/awslabs/aidlc-workflows/blob/${upstreamBranch}/CHANGELOG.md`,
    "",
    "## What this PR changed",
    "",
    `- 書き換え/追加: ${plan.writes.length} ファイル（うち既存の上書き ${plan.overwrites.length}）`,
    `- 削除: ${plan.deletes.length} ファイル`,
    `- 温存（このリポジトリ所有）: ${capped(plan.preserved)}`,
    "",
    ...(plan.overwrites.length > 0
      ? [`上書きされた既存ファイル: ${capped(plan.overwrites)}`, ""]
      : []),
    ...(plan.deletes.length > 0 ? [`削除されたファイル: ${capped(plan.deletes)}`, ""] : []),
    "## Why this is labelled `release:skip`",
    "",
    "`.claude/` は VSIX に同梱されず（`.vscodeignore` は `dist/` と `media/` のみ）、実行時のドキュメント解決はユーザ側の `docsRepoPath` を見ます。ここでの `.claude/` は品質ゲートのフィクスチャ（`data-lint` が bridge-map の 33 エントリをこのステージツリーに対して検証する）であり、更新そのものはユーザに見える変更ではありません。ユーザに見える変更をこのブランチに載せた場合はラベルを貼り替えてください。",
    "",
    "## Review checklist",
    "",
    "- [ ] 下の互換性チェックで挙がった項目に対応した（bridge-map / agent-map / shared-types / stage-map）",
    "- [ ] `bun run check` の結果を確認した（ジョブ内で実行済み。結果はこの PR の本文末尾または Actions のサマリを参照）",
    "",
  ].join("\n");
}

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

const USAGE = `Usage:
  bun scripts/sync-workflows-shell.ts --upstream <checkout> --upstream-sha <sha>
    [--workspace <root>] [--upstream-branch <name>] [--pr-body <file>]
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
  const upstreamSha = flagValue(argv, "--upstream-sha");
  if (upstream === undefined || upstreamSha === undefined) throw new UsageError();

  const workspaceRoot = path.resolve(
    flagValue(argv, "--workspace") ?? path.join(import.meta.dirname, ".."),
  );
  const upstreamBranch = flagValue(argv, "--upstream-branch") ?? "main";
  // Read every flag, and claim the PR body destination, before the first write:
  // this run copies and deletes, and there is no half-applied shell worth
  // leaving behind.
  const prBodyPath = flagValue(argv, "--pr-body");
  if (prBodyPath !== undefined) {
    const resolved = path.resolve(prBodyPath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, "");
  }

  const upstreamShellRoot = path.join(path.resolve(upstream), UPSTREAM_SHELL_REL);
  const upstreamFiles = walkShellFiles(upstreamShellRoot);
  // Judge the OUTCOME, not the cause. The shell reaches the mirror empty when
  // it is absent, replaced by a file, or fetched by a sparse checkout that came
  // back with nothing -- and every one of those turns into "upstream deleted
  // the entire shell", which this script would faithfully carry out.
  if (upstreamFiles.size === 0) {
    throw new Error(`upstream checkout has no shell files under ${upstreamShellRoot}`);
  }
  const version = readShellVersion(upstreamShellRoot);
  if (version === null) {
    throw new Error(
      `could not read AIDLC_VERSION from ${path.join(upstreamShellRoot, VERSION_REL)}`,
    );
  }

  const localShellRoot = path.join(workspaceRoot, SHELL_REL);
  const previousVersion = readShellVersion(localShellRoot);
  const plan = planShellSync(upstreamFiles, walkShellFiles(localShellRoot));

  // Before the first write: the mirror runs on Linux and would happily create a
  // path Windows cannot check out, and the sync PR is precisely the change that
  // may never see the three-OS matrix. The set is everything that will EXIST
  // after the sync, not just what upstream sends -- a preserved local-only file
  // stays on disk and could collide with a case variant upstream publishes.
  const surviving = [...upstreamFiles.keys(), ...plan.preserved].filter(
    (rel) => !plan.deletes.includes(rel),
  );
  const unportable = unportablePaths(surviving);
  if (unportable.length > 0) {
    throw new Error(`paths are not portable across supported OSes: ${unportable.join(", ")}`);
  }

  applyShellSync({ workspaceRoot, upstreamShellRoot, plan });

  if (prBodyPath !== undefined) {
    writeFileSync(
      path.resolve(prBodyPath),
      formatShellPrBody({ version, previousVersion, upstreamSha, upstreamBranch, plan }),
    );
  }

  return [
    `version=${version}`,
    `previous_version=${previousVersion ?? ""}`,
    `sha=${upstreamSha}`,
    `written=${plan.writes.length}`,
    `overwritten=${plan.overwrites.length}`,
    `deleted=${plan.deletes.length}`,
    `preserved=${plan.preserved.length}`,
    `changed=${plan.writes.length > 0 || plan.deletes.length > 0}`,
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
