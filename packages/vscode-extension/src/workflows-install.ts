import { realpathSync } from "node:fs";
import path from "node:path";
import { formatDoctorDetailsForLog, type NativeDoctorReport } from "./doctor-output.ts";
import { CODEX_GIT_REQUIRED, isGitRepository } from "./git-prerequisite.ts";
import { findHarnessConflict } from "./harness-conflicts.ts";
import { detectHarnesses, HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import { configureNativeHarness } from "./native-harness-install.ts";
import { readNativeProjections } from "./native-projection.ts";
import {
  type configureNative,
  inspectProjectPin,
  installNative,
  type NativeInstall,
  readNativeInstall,
  readVersionedNativeInstall,
  SETUP_RELEASE,
} from "./native-setup.ts";
import {
  harnessVersionRel,
  readAllWorkspaceAidlcVersions,
  requiresNativeInstaller,
} from "./workflows-version.ts";

export type WorkflowsHarnessInstallResult = {
  id: HarnessId;
  status: "configured" | "skipped" | "failed" | "cancelled";
  message: string;
  doctorOk?: boolean;
  doctorReport?: NativeDoctorReport;
};

export type WorkflowsInstallResult = {
  ok: boolean;
  target: string | null;
  message: string;
  reason?:
    | "empty-selection"
    | "invalid-selection"
    | "collision"
    | "git-required"
    | "version-conflict"
    | "pin-unreadable"
    | "pin-unavailable"
    | "version-unreadable"
    | "busy"
    | "cancelled"
    | "install-failed"
    | "missing-binary"
    | "configure-failed"
    | "preflight-failed";
  harnesses: WorkflowsHarnessInstallResult[];
};

export type WorkflowsInstallHooks = {
  detect?: (root: string) => HarnessId[];
  readWorkspaceVersions?: (root: string) => (string | null)[];
  inspectPin?: typeof inspectProjectPin;
  readActive?: typeof readNativeInstall;
  readInstall?: typeof readVersionedNativeInstall;
  isGitRepository?: typeof isGitRepository;
  install?: typeof installNative;
  configure?: typeof configureNative;
};

export type WorkflowsInstallOptions = {
  workspaceRoot: string;
  selected: HarnessId[];
  log: (line: string) => void;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  onHarnessResult?: (result: WorkflowsHarnessInstallResult) => void;
  hooks?: WorkflowsInstallHooks;
};

const runningRoots = new Set<string>();
const STRICT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function rootKey(root: string): string {
  let resolved = path.resolve(root);
  try {
    resolved = realpathSync(resolved);
  } catch {
    // A caller can lose its folder while a process is stopping. Keep its lock until then.
  }
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function workspaceVersions(root: string, detected: HarnessId[]): (string | null)[] {
  const records = readAllWorkspaceAidlcVersions(root);
  const native = readNativeProjections(root);
  const missing = detected.filter(
    (id) =>
      !native.some((projection) => projection.harness === id) &&
      !records.some((record) => record.sourcePath === path.join(root, harnessVersionRel(id))),
  );
  return [...records.map((record) => record.version), ...missing.map(() => null)];
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Configure the missing tools in order, preserving installed tools and partial successes. */
export async function installWorkflows(
  opts: WorkflowsInstallOptions,
): Promise<WorkflowsInstallResult> {
  const harnesses: WorkflowsHarnessInstallResult[] = [];
  let target: string | null = null;
  const fail = (
    reason: NonNullable<WorkflowsInstallResult["reason"]>,
    message: string,
  ): WorkflowsInstallResult => {
    opts.log(message);
    return { ok: false, target, reason, message, harnesses };
  };
  if (
    !Array.isArray(opts.selected) ||
    opts.selected.some((id) => typeof id !== "string" || !Object.hasOwn(HARNESS_LABELS, id))
  )
    return fail("invalid-selection", "選択されたツールを確認できません。選び直してください。");
  const selected = [...new Set(opts.selected)];
  if (selected.length === 0)
    return fail("empty-selection", "インストール先のツールを1つ以上選んでください。");
  const key = rootKey(opts.workspaceRoot);
  if (runningRoots.has(key))
    return fail("busy", "このフォルダのインストールは実行中です。完了するまでお待ちください。");
  runningRoots.add(key);
  const current = () => !opts.signal?.aborted && opts.isCurrent?.() !== false;
  const report = (result: WorkflowsHarnessInstallResult) => {
    harnesses.push(result);
    opts.onHarnessResult?.(result);
  };
  const cancelled = (): WorkflowsInstallResult => {
    for (const id of selected) {
      if (!harnesses.some((result) => result.id === id))
        report({
          id,
          status: "cancelled",
          message: `${HARNESS_LABELS[id]} の設定を中止しました。`,
        });
    }
    return fail(
      "cancelled",
      "インストールを中止しました。完了済みのツールの設定は保存されています。",
    );
  };

  try {
    if (!current()) return cancelled();
    const hooks = opts.hooks;
    const detected =
      hooks?.detect?.(opts.workspaceRoot) ??
      detectHarnesses(opts.workspaceRoot).harnesses.map((harness) => harness.id);
    const conflict = findHarnessConflict([...detected, ...selected]);
    if (conflict) return fail("collision", conflict.message);
    const pending = selected.filter((id) => !detected.includes(id));
    if (pending.includes("codex")) {
      const gitReady = await (hooks?.isGitRepository ?? isGitRepository)(
        opts.workspaceRoot,
        opts.signal,
      );
      if (!current()) return cancelled();
      if (!gitReady) return fail("git-required", CODEX_GIT_REQUIRED);
    }
    const pin = (hooks?.inspectPin ?? inspectProjectPin)(opts.workspaceRoot);
    if (pin.exists && (pin.version === null || !STRICT_VERSION.test(pin.version)))
      return fail(
        "pin-unreadable",
        "プロジェクトの固定版（.aidlc-version）が読めません。公式手順から固定版を確認してください。",
      );
    const versions = hooks?.readWorkspaceVersions
      ? hooks.readWorkspaceVersions(opts.workspaceRoot)
      : workspaceVersions(opts.workspaceRoot, detected);
    if (
      (detected.length > 0 && versions.length === 0) ||
      versions.some((version) => version === null || !STRICT_VERSION.test(version))
    )
      return fail(
        "version-unreadable",
        "既存のツール設定の版を確認できません。「aidlc-workflows を更新」または公式手順から確認してから追加してください。",
      );
    const projectVersions = new Set([...versions, ...(pin.version ? [pin.version] : [])]);
    if (projectVersions.size > 1)
      return fail(
        "version-conflict",
        "既存のツール設定とプロジェクトの固定版が一致していません。「aidlc-workflows を更新」で版を揃えてから追加してください。",
      );

    const readActive = hooks?.readActive ?? readNativeInstall;
    const readInstall = hooks?.readInstall ?? readVersionedNativeInstall;
    const active = readActive();
    target = pin.version ?? versions[0] ?? active?.version ?? SETUP_RELEASE;
    if (!STRICT_VERSION.test(target) || !requiresNativeInstaller(target))
      return fail(
        "version-conflict",
        `本体 ${target} にはこの画面からツールを追加できません。「aidlc-workflows を更新」または公式手順から更新してください。`,
      );
    if (!pin.exists && active !== null && active.version !== target)
      return fail(
        "version-conflict",
        `プロジェクトの版 ${target} と本体の既定版 ${active.version} が一致していません。「aidlc-workflows を更新」または公式手順から版を揃えてから追加してください。`,
      );
    let runtime: NativeInstall | null = readInstall(target);
    // Reinstalling a broken pin would also change the machine's active version.
    // Adding a harness must not silently repair or activate another project's runtime.
    if (
      pin.exists &&
      active !== null &&
      (readActive(opts.workspaceRoot)?.version !== target || runtime?.version !== target)
    )
      return fail(
        "pin-unavailable",
        "プロジェクトの固定版を実行できません。公式手順から固定版の本体と登録を修復してから追加してください。",
      );
    for (const id of selected) {
      if (detected.includes(id)) {
        const message = `${HARNESS_LABELS[id]} は設定済みです。`;
        opts.log(message);
        report({ id, status: "skipped", message });
      }
    }
    if (!current()) return cancelled();
    // The stable launcher must exist even when an exact retained version is available.
    if (active === null || runtime === null || runtime.version !== target) {
      try {
        await (hooks?.install ?? installNative)(opts.log, undefined, fetch, target, {
          ...(opts.signal ? { signal: opts.signal } : {}),
          ...(opts.isCurrent ? { isCurrent: opts.isCurrent } : {}),
        });
      } catch (cause) {
        if (!current()) return cancelled();
        return fail(
          "install-failed",
          `AI-DLC 本体のインストールに失敗しました: ${errorMessage(cause)}`,
        );
      }
      if (!current()) return cancelled();
      runtime = readInstall(target);
      if (readActive() === null) runtime = null;
    }
    if (runtime === null || runtime.version !== target)
      return fail(
        "missing-binary",
        `本体 ${target} の配置を確認できません。公式手順でインストール先を確認してください。`,
      );
    if (pin.exists) {
      const pinnedRuntime = readActive(opts.workspaceRoot);
      if (pinnedRuntime === null || pinnedRuntime.version !== target)
        return fail(
          "pin-unavailable",
          "プロジェクトの固定版を実行できません。公式手順から固定版の登録を修復してから追加してください。",
        );
      runtime = pinnedRuntime;
    }
    for (const id of pending) {
      if (!current()) return cancelled();
      try {
        const result = await (hooks?.configure ?? configureNativeHarness)(
          runtime,
          opts.workspaceRoot,
          id,
          opts.log,
          undefined,
          {
            mcp: "preserve",
            ...(opts.signal ? { signal: opts.signal } : {}),
            ...(opts.isCurrent ? { isCurrent: opts.isCurrent } : {}),
          },
        );
        if (!current()) return cancelled();
        const details = result.doctorReport
          ? formatDoctorDetailsForLog(result.doctorReport)
          : result.details;
        if (details.trim()) opts.log(`${HARNESS_LABELS[id]} の診断結果:\n${details}`);
        const needsAttention = result.doctorReport
          ? result.doctorReport.outcome !== "ok"
          : !result.doctorOk;
        report({
          id,
          status: "configured",
          message: needsAttention
            ? `${HARNESS_LABELS[id]} を設定しました。診断結果を確認してください。`
            : `${HARNESS_LABELS[id]} の設定が完了しました。`,
          doctorOk: result.doctorOk,
          ...(result.doctorReport ? { doctorReport: result.doctorReport } : {}),
        });
      } catch (cause) {
        if (!current()) return cancelled();
        const message = `${HARNESS_LABELS[id]} の設定に失敗しました: ${errorMessage(cause)}`;
        opts.log(message);
        report({ id, status: "failed", message });
      }
    }
    if (harnesses.some((result) => result.status === "failed"))
      return fail(
        "configure-failed",
        "一部のツールを設定できませんでした。結果を確認して再実行してください。",
      );
    const needsAttention = harnesses.some(
      (result) =>
        result.status === "configured" &&
        (result.doctorReport ? result.doctorReport.outcome !== "ok" : !result.doctorOk),
    );
    const message = needsAttention
      ? "選択したツールを設定しました。診断結果に確認が必要な項目があります。"
      : "選択したツールの準備が完了しました。";
    return { ok: true, target, message, harnesses };
  } catch (cause) {
    if (!current()) return cancelled();
    return fail(
      "preflight-failed",
      `インストールの状態を確認できませんでした: ${errorMessage(cause)}`,
    );
  } finally {
    runningRoots.delete(key);
  }
}
