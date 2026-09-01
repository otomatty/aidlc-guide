import { execFile } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { UPSTREAM_ARCHIVE_BASE } from "@aidlc-guide/shared-types";
import { HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import { UPDATE_USER_AGENT } from "./update-release.ts";
import {
  compareWorkflowsVersion,
  harnessVersionRel,
  parseAidlcVersionSource,
  readWorkspaceAidlcVersion,
} from "./workflows-version.ts";

const execFileAsync = promisify(execFile);

export const WORKFLOWS_ARCHIVE_TIMEOUT_MS = 120_000;

export type CursorInstallFn = (
  installTs: string,
  workspaceRoot: string,
) => Promise<{ ok: boolean; log: string }>;

export type ApplyRequest = {
  workspaceRoot: string;
  distRoot: string;
  pin: string;
  selected: HarnessId[];
  aidlcDirCollision: boolean;
  runCursorInstall?: CursorInstallFn;
};

export type ApplyFailureReason =
  | "pin-mismatch"
  | "collision"
  | "missing-dist"
  | "empty-selection"
  | "cursor-install"
  | "would-downgrade"
  | "copy-failed";

export type ApplyResult = {
  ok: boolean;
  log: string[];
  failed: HarnessId[];
  reason?: ApplyFailureReason;
};

const DIST_VERSION_RELS = [
  ["dist", "claude", ".claude", "tools", "aidlc-version.ts"],
  ["dist", "copilot", ".aidlc", "tools", "aidlc-version.ts"],
  ["dist", "cursor", ".cursor", "tools", "aidlc-version.ts"],
  ["dist", "opencode", ".aidlc", "tools", "aidlc-version.ts"],
  ["dist", "codex", ".codex", "tools", "aidlc-version.ts"],
  ["dist", "kiro", ".kiro", "tools", "aidlc-version.ts"],
  ["dist", "kiro-ide", ".kiro", "tools", "aidlc-version.ts"],
] as const;

type EngineCopy = {
  from: string[];
  to: string[];
  filter?: "github-aidlc";
};

export function workflowsArchiveUrl(pin: string): string {
  const version = pin.replace(/^[vV]/, "");
  return `${UPSTREAM_ARCHIVE_BASE}/refs/tags/v${version}`;
}

export function workflowsCommitArchiveUrl(sha: string): string {
  return `${UPSTREAM_ARCHIVE_BASE}/${sha}`;
}

export function findExtractedRepoRoot(extractDir: string): string | null {
  if (existsSync(path.join(extractDir, "dist"))) return extractDir;
  let entries: string[];
  try {
    entries = readdirSync(extractDir);
  } catch {
    return null;
  }
  for (const name of entries) {
    const child = path.join(extractDir, name);
    if (existsSync(path.join(child, "dist"))) return child;
  }
  return null;
}

export function readDistAidlcVersion(distRoot: string): string | null {
  let found: string | null = null;
  for (const rel of DIST_VERSION_RELS) {
    const file = path.join(distRoot, ...rel);
    if (!existsSync(file)) continue;
    try {
      const version = parseAidlcVersionSource(readFileSync(file, "utf8"));
      if (version === null) return null;
      if (found !== null && version !== found) return null;
      found = version;
    } catch {
      return null;
    }
  }
  return found;
}

function posixRel(rel: string): string {
  return rel.split(path.sep).join("/");
}

function isTeamOwnedShellPath(rel: string): boolean {
  const n = posixRel(rel);
  if (n === "active-space") return true;
  if (/^spaces\/[^/]+\/memory\/(team|project)\.md$/.test(n)) return true;
  return /^spaces\/[^/]+\/(knowledge|intents)(?:\/|$)/.test(n);
}

function isAidlcGithubRel(rel: string): boolean {
  return posixRel(rel)
    .split("/")
    .some((part) => part.startsWith("aidlc"));
}

type CopyDecision = "copy" | "skip" | "skip-if-exists";

function isEnoent(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";
}

function assertNoSymlinkAlong(dest: string, stopAt: string): void {
  const stop = path.resolve(stopAt);
  let current = path.resolve(dest);
  for (;;) {
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error(`シンボリックリンクには書き込みません: ${current}`);
      }
    } catch (cause) {
      if (!isEnoent(cause)) throw cause;
    }
    if (current === stop) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function copyOverlay(
  srcRoot: string,
  destRoot: string,
  rel: string,
  decide: (rel: string, isDirectory: boolean) => CopyDecision,
): void {
  const src = rel === "" ? srcRoot : path.join(srcRoot, rel);
  const dest = rel === "" ? destRoot : path.join(destRoot, rel);
  assertNoSymlinkAlong(dest, destRoot);
  const st = statSync(src);
  if (st.isDirectory()) {
    if (rel !== "") {
      const decision = decide(rel, true);
      if (decision === "skip") return;
      if (decision === "skip-if-exists" && existsSync(dest)) return;
    }
    mkdirSync(dest, { recursive: true });
    for (const name of readdirSync(src)) {
      const child = rel === "" ? name : path.join(rel, name);
      copyOverlay(srcRoot, destRoot, child, decide);
    }
    return;
  }
  const decision = decide(rel, false);
  if (decision === "skip") return;
  if (decision === "skip-if-exists" && existsSync(dest)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function engineCopies(id: HarnessId): EngineCopy[] {
  switch (id) {
    case "cursor":
      return [];
    case "claude":
      return [{ from: ["dist", "claude", ".claude"], to: [".claude"] }];
    case "copilot":
      return [
        { from: ["dist", "copilot", ".aidlc"], to: [".aidlc"] },
        { from: ["dist", "copilot", ".github"], to: [".github"], filter: "github-aidlc" },
      ];
    case "opencode":
      return [
        { from: ["dist", "opencode", ".aidlc"], to: [".aidlc"] },
        { from: ["dist", "opencode", ".opencode"], to: [".opencode"] },
      ];
    case "codex":
      return [
        { from: ["dist", "codex", ".codex"], to: [".codex"] },
        { from: ["dist", "codex", ".agents"], to: [".agents"] },
      ];
    case "kiro":
      return [{ from: ["dist", "kiro", ".kiro"], to: [".kiro"] }];
    case "kiro-ide":
      return [{ from: ["dist", "kiro-ide", ".kiro"], to: [".kiro"] }];
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message !== "") return cause.message;
  return String(cause);
}

function isAtOrAbovePin(workspaceRoot: string, id: HarnessId, pin: string): boolean {
  const file = path.join(workspaceRoot, harnessVersionRel(id));
  if (!existsSync(file)) return false;
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  return compareWorkflowsVersion(parseAidlcVersionSource(raw), pin).kind === "current-or-newer";
}

function anyInstalledAtOrAbovePin(workspaceRoot: string, pin: string): boolean {
  for (const id of Object.keys(HARNESS_LABELS) as HarnessId[]) {
    if (isAtOrAbovePin(workspaceRoot, id, pin)) return true;
  }
  return false;
}

function distFolder(id: HarnessId): string {
  switch (id) {
    case "cursor":
      return "cursor";
    case "claude":
      return "claude";
    case "copilot":
      return "copilot";
    case "opencode":
      return "opencode";
    case "codex":
      return "codex";
    case "kiro":
      return "kiro";
    case "kiro-ide":
      return "kiro-ide";
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

export async function defaultRunCursorInstall(
  installTs: string,
  workspaceRoot: string,
): Promise<{ ok: boolean; log: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("bun", [installTs, workspaceRoot], {
      timeout: 120_000,
      windowsHide: true,
    });
    return { ok: true, log: `${stdout}${stderr}` };
  } catch (cause) {
    const err = cause as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      log: `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? "bun failed"}`,
    };
  }
}

export async function applyWorkflowsUpdate(req: ApplyRequest): Promise<ApplyResult> {
  const log: string[] = [];
  const failed: HarnessId[] = [];
  if (req.selected.length === 0) {
    return { ok: false, log: ["何も選択されていません。"], failed, reason: "empty-selection" };
  }

  const distVersion = readDistAidlcVersion(req.distRoot);
  if (distVersion !== req.pin) {
    return {
      ok: false,
      log: [
        `取得した AIDLC_VERSION（${distVersion ?? "不明"}）が Guide 想定（${req.pin}）と一致しません。`,
      ],
      failed,
      reason: "pin-mismatch",
    };
  }

  const installed = readWorkspaceAidlcVersion(req.workspaceRoot);
  if (installed.version !== null) {
    const installedStatus = compareWorkflowsVersion(installed.version, req.pin);
    if (installedStatus.kind === "current-or-newer") {
      return {
        ok: false,
        log: [
          `ワークスペースは想定版以上（${installed.version} ≥ ${req.pin}）です。ダウングレードはしません。`,
        ],
        failed,
        reason: "would-downgrade",
      };
    }
  }

  const selected = new Set(req.selected);
  if (selected.has("copilot") && selected.has("opencode")) {
    return {
      ok: false,
      log: [
        "Copilot と opencode はどちらも .aidlc/ を使うため、同時には更新しません。どちらか一方のチェックを外してください。",
      ],
      failed: ["copilot", "opencode"],
      reason: "collision",
    };
  }

  const preserveNewerShell = anyInstalledAtOrAbovePin(req.workspaceRoot, req.pin);
  const overlayToApply = req.selected.filter(
    (id) => id !== "cursor" && !isAtOrAbovePin(req.workspaceRoot, id, req.pin),
  );
  const cursorWillInstall =
    selected.has("cursor") &&
    !isAtOrAbovePin(req.workspaceRoot, "cursor", req.pin) &&
    !preserveNewerShell;
  if (
    !preserveNewerShell &&
    !cursorWillInstall &&
    overlayToApply.length > 0 &&
    findShellSource(req.distRoot, overlayToApply) === null
  ) {
    return {
      ok: false,
      log: ["共有 aidlc/ シェルの dist が見つかりません。"],
      failed,
      reason: "missing-dist",
    };
  }

  const applied: HarnessId[] = [];
  let copyFailed = false;
  let cursorDidShell = false;
  if (selected.has("cursor")) {
    if (isAtOrAbovePin(req.workspaceRoot, "cursor", req.pin)) {
      log.push("cursor は想定版以上のためスキップしました。");
    } else if (preserveNewerShell) {
      log.push("cursor は共有シェルを想定版以上のハーネスが使っているためスキップしました。");
    } else {
      const installTs = path.join(req.distRoot, "dist", "cursor", "install.ts");
      if (!existsSync(installTs)) {
        log.push("dist/cursor/install.ts が見つかりません。");
        failed.push("cursor");
      } else {
        const run = req.runCursorInstall ?? defaultRunCursorInstall;
        const result = await run(installTs, req.workspaceRoot);
        log.push(result.log.trim() === "" ? "Cursor インストーラーを実行しました。" : result.log);
        if (result.ok) {
          cursorDidShell = true;
          applied.push("cursor");
        } else {
          failed.push("cursor");
        }
      }
    }
  }

  for (const id of req.selected) {
    if (id === "cursor") continue;
    if (isAtOrAbovePin(req.workspaceRoot, id, req.pin)) {
      log.push(`${id} は想定版以上のためスキップしました。`);
      continue;
    }
    const copies = engineCopies(id);
    let copied = false;
    try {
      for (const spec of copies) {
        const from = path.join(req.distRoot, ...spec.from);
        if (!existsSync(from)) continue;
        const to = path.join(req.workspaceRoot, ...spec.to);
        copyOverlay(from, to, "", (rel, isDirectory) => {
          if (spec.filter === "github-aidlc") {
            if (isDirectory) return "copy";
            return isAidlcGithubRel(rel) ? "copy" : "skip";
          }
          return "copy";
        });
        copied = true;
      }
    } catch (cause) {
      log.push(`${id} のコピーに失敗しました: ${errorMessage(cause)}`);
      failed.push(id);
      copyFailed = true;
      continue;
    }
    if (!copied) {
      log.push(`${id} の dist が見つかりません。`);
      failed.push(id);
    } else {
      applied.push(id);
      log.push(`${id} のエンジンツリーを更新しました。`);
    }
  }

  if (applied.length === 0 && failed.length === 0) {
    return {
      ok: false,
      log: [...log, "選択したハーネスはすべて想定版以上です。ダウングレードはしません。"],
      failed,
      reason: "would-downgrade",
    };
  }

  if (!cursorDidShell && failed.length === 0) {
    if (preserveNewerShell) {
      log.push("共有 aidlc/ は想定版以上のハーネスがあるためスキップしました。");
    } else {
      const shellFrom = findShellSource(req.distRoot, applied);
      if (shellFrom === null) {
        log.push("共有 aidlc/ シェルの dist が見つかりません。");
        return { ok: false, log, failed, reason: "missing-dist" };
      }
      const shellTo = path.join(req.workspaceRoot, "aidlc");
      try {
        copyOverlay(shellFrom, shellTo, "", (rel) =>
          isTeamOwnedShellPath(rel) ? "skip-if-exists" : "copy",
        );
        log.push(
          "共有 aidlc/ シェルを一度だけ更新しました（team.md / project.md / intents は保持）。",
        );
      } catch (cause) {
        log.push(`共有 aidlc/ シェルの更新に失敗しました: ${errorMessage(cause)}`);
        return { ok: false, log, failed, reason: "copy-failed" };
      }
    }
  }

  return {
    ok: failed.length === 0,
    log,
    failed,
    reason: failed.includes("cursor")
      ? "cursor-install"
      : copyFailed
        ? "copy-failed"
        : failed.length > 0
          ? "missing-dist"
          : undefined,
  };
}

function findShellSource(distRoot: string, selected: HarnessId[]): string | null {
  const order: HarnessId[] = ["claude", "copilot", "opencode", "codex", "kiro", "kiro-ide"];
  for (const id of order) {
    if (!selected.includes(id)) continue;
    const src = path.join(distRoot, "dist", distFolder(id), "aidlc");
    if (existsSync(src)) return src;
  }
  return null;
}

export type ArchiveSource = "commit" | "tag";

export type DownloadArchiveResult =
  | { ok: true; bytes: Uint8Array; source: ArchiveSource }
  | { ok: false; reason: "timeout" | "network" | "http" | "not-found" };

async function fetchArchive(
  url: string,
  source: ArchiveSource,
  fetchImpl: typeof fetch,
): Promise<DownloadArchiveResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/gzip, application/x-gzip, application/x-tar",
        "User-Agent": UPDATE_USER_AGENT,
      },
      signal: AbortSignal.timeout(WORKFLOWS_ARCHIVE_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut =
      typeof cause === "object" &&
      cause !== null &&
      "name" in cause &&
      (cause.name === "TimeoutError" || cause.name === "AbortError");
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  }
  if (response.status === 404) return { ok: false, reason: "not-found" };
  if (!response.ok) return { ok: false, reason: "http" };
  try {
    return { ok: true, bytes: new Uint8Array(await response.arrayBuffer()), source };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/**
 * Fetch the pinned upstream tree. The pin is an `AIDLC_VERSION`, which upstream
 * bumps per commit while publishing release tags only for milestones, so
 * `refs/tags/v<pin>` usually does not exist. The manifest's `upstreamSha` names
 * the exact snapshotted commit and is tried first; the tag URL stays as the
 * fallback for manifests written before the sha was recorded.
 *
 * That fallback fires on 404 alone — the one answer that means the commit is
 * genuinely gone. Any other failure (403, 429, 5xx, a dropped connection) means
 * we could not ask, and `applyWorkflowsUpdate` checks only the archive's
 * embedded `AIDLC_VERSION`, never that its tree is `upstreamSha`: silently
 * taking the tag there would install a tree the manifest never pinned.
 */
export async function downloadWorkflowsArchive(
  pin: string,
  fetchImpl: typeof fetch = fetch,
  upstreamSha: string | null = null,
): Promise<DownloadArchiveResult> {
  if (upstreamSha !== null && upstreamSha !== "") {
    const byCommit = await fetchArchive(
      workflowsCommitArchiveUrl(upstreamSha),
      "commit",
      fetchImpl,
    );
    if (byCommit.ok || byCommit.reason !== "not-found") return byCommit;
  }
  return fetchArchive(workflowsArchiveUrl(pin), "tag", fetchImpl);
}

export async function extractDownloadedArchive(
  archivePath: string,
  dest: string,
): Promise<{ ok: boolean; log: string }> {
  try {
    mkdirSync(dest, { recursive: true });
    const relative = path.relative(dest, archivePath);
    const archiveArg = (relative === "" ? path.basename(archivePath) : relative)
      .split(path.sep)
      .join("/");
    await execFileAsync("tar", ["-xzf", archiveArg], {
      cwd: dest,
      timeout: 60_000,
      windowsHide: true,
    });
    return { ok: true, log: "アーカイブを展開しました。" };
  } catch (cause) {
    const err = cause as { stderr?: string; message?: string };
    return { ok: false, log: err.stderr ?? err.message ?? "展開に失敗しました。" };
  }
}
