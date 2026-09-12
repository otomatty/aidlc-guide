import { formatDoctorDetailsForLog } from "./doctor-output.ts";
import { findHarnessConflict } from "./harness-conflicts.ts";
import type { HarnessId } from "./harness-detect.ts";
import { configureNativeHarness } from "./native-harness-install.ts";
import {
  type configureNative,
  inspectProjectPin,
  installNative,
  type NativeInstall,
  pinNative,
  readNativeInstall,
  readVersionedNativeInstall,
  SETUP_RELEASE,
  unpinNative,
  useNative,
} from "./native-setup.ts";
import { compareSemver, parseSemver } from "./update-release.ts";
import { readAllWorkspaceAidlcVersions } from "./workflows-version.ts";

export type NativeWorkflowsUpdateResult = {
  ok: boolean;
  reason?: string;
  target: string;
};

export type NativeWorkflowsUpdateHooks = {
  readInstall?: (version: string) => NativeInstall | null;
  readActive?: () => NativeInstall | null;
  readProjectPin?: (root: string) => string | null;
  readProjectPinState?: (root: string) => { exists: boolean; version: string | null };
  readWorkspaceVersions?: (root: string) => (string | null)[];
  install?: typeof installNative;
  use?: typeof useNative;
  pin?: typeof pinNative;
  unpin?: typeof unpinNative;
  configure?: typeof configureNative;
};

export type NativeUpdateBlockReason = "pin-invalid" | "pin-ahead";

/**
 * Why a native (2.8+) docs pin cannot be installed by this Guide build, or
 * null when `SETUP_RELEASE` is a compatible target.
 */
export function nativeUpdateBlockReason(pin: string): NativeUpdateBlockReason | null {
  const pinVersion = parseSemver(pin);
  const bootstrap = parseSemver(SETUP_RELEASE);
  if (pinVersion === null || pinVersion.prerelease !== "" || bootstrap === null)
    return "pin-invalid";
  if (compareSemver(pinVersion, bootstrap) > 0) return "pin-ahead";
  return null;
}

/**
 * Machine runtime for a native (2.8+) docs pin: the Setup bootstrap release
 * when that pin is not newer than the bootstrap. Docs `sourceVersion` moves on
 * every upstream commit and usually has no GitHub release tag, so the pin is
 * never used as an installer version.
 */
export function nativeUpdateRelease(pin: string): string | null {
  return nativeUpdateBlockReason(pin) === null ? SETUP_RELEASE : null;
}

export function needsNativeMachineInstall(install: NativeInstall | null, target: string): boolean {
  return install === null || install.version !== target;
}

export function wouldDowngradeWorkspace(versions: (string | null)[], target: string): boolean {
  const targetVersion = parseSemver(target);
  if (targetVersion === null) return false;
  return versions.some((version) => {
    const parsed = version === null ? null : parseSemver(version);
    return parsed !== null && compareSemver(parsed, targetVersion) > 0;
  });
}

/** Harnesses that must take part in a native update. */
export function omittedRequiredHarnesses(
  detected: HarnessId[],
  selected: HarnessId[],
): HarnessId[] {
  return detected.filter((id) => !selected.includes(id));
}

function isIncompleteRetainedUseError(message: string): boolean {
  return (
    /retained version \S+ is incomplete/i.test(message) || /not installed completely/i.test(message)
  );
}

export async function applyNativeWorkflowsUpdate(opts: {
  workspaceRoot: string;
  pin: string;
  selected: HarnessId[];
  detected?: HarnessId[];
  log: (line: string) => void;
  isCurrent?: () => boolean;
  canRestore?: () => boolean;
  hooks?: NativeWorkflowsUpdateHooks;
}): Promise<NativeWorkflowsUpdateResult> {
  const blocked = nativeUpdateBlockReason(opts.pin);
  if (blocked === "pin-ahead") {
    opts.log(
      `この Guide の想定版 ${opts.pin} は、拡張が導入できる本体 ${SETUP_RELEASE} より新しいため、自動更新はできません。公式手順から手動で更新してください。`,
    );
    return { ok: false, reason: blocked, target: opts.pin };
  }
  if (blocked !== null) {
    opts.log("Guide の想定版が読めません。公式手順から手動で更新してください。");
    return { ok: false, reason: blocked, target: opts.pin };
  }
  const target = SETUP_RELEASE;
  if (opts.selected.length === 0) {
    opts.log("更新するツールが選ばれていません。");
    return { ok: false, reason: "empty-selection", target };
  }
  const detected = opts.detected ?? opts.selected;
  const conflict = findHarnessConflict([...detected, ...opts.selected]);
  if (conflict) {
    opts.log(`${conflict.message}公式手順から手動で更新してください。`);
    return { ok: false, reason: "collision", target };
  }
  if (
    omittedRequiredHarnesses(detected, opts.selected).length > 0 ||
    omittedRequiredHarnesses(opts.selected, detected).length > 0
  ) {
    opts.log(
      "検出結果と選択が一致していません。パネルを閉じて開き直してから、検出されたハーネスをすべて更新してください。",
    );
    return { ok: false, reason: "incomplete-selection", target };
  }

  const readInstall = opts.hooks?.readInstall ?? readVersionedNativeInstall;
  const readActive = opts.hooks?.readActive ?? readNativeInstall;
  const readPinHook = opts.hooks?.readProjectPin;
  const inspectPin =
    opts.hooks?.readProjectPinState ??
    (readPinHook
      ? (root: string) => {
          const version = readPinHook(root);
          return { exists: version !== null, version };
        }
      : inspectProjectPin);
  const readWorkspaceVersions =
    opts.hooks?.readWorkspaceVersions ??
    ((root: string) => readAllWorkspaceAidlcVersions(root).map((item) => item.version));
  const install = opts.hooks?.install ?? installNative;
  const use = opts.hooks?.use ?? useNative;
  const pin = opts.hooks?.pin ?? pinNative;
  const unpin = opts.hooks?.unpin ?? unpinNative;
  const configure = opts.hooks?.configure ?? configureNativeHarness;
  const previousMachine = readActive();
  const previousActive = previousMachine?.version ?? null;
  const pinState = inspectPin(opts.workspaceRoot);
  if (pinState.exists && pinState.version === null) {
    opts.log(
      "プロジェクトの固定版（.aidlc-version）が読めません。上書きや削除はせず、公式手順から確認してください。",
    );
    return { ok: false, reason: "pin-unreadable", target };
  }
  const previousPin = pinState.version;
  if (
    wouldDowngradeWorkspace([...readWorkspaceVersions(opts.workspaceRoot), previousPin], target)
  ) {
    opts.log(
      `このワークスペースには本体 ${target} より新しいハーネスまたは固定版があるため、自動更新はダウングレードになります。公式手順から手動で更新してください。`,
    );
    return { ok: false, reason: "would-downgrade", target };
  }

  const stillHere = (): boolean => opts.isCurrent?.() !== false;
  const folderWritable = (): boolean => opts.canRestore?.() !== false;
  const restoreActiveRuntime = async (): Promise<void> => {
    if (previousActive === null || previousActive === target) return;
    const from = previousMachine ?? readInstall(previousActive);
    if (from === null) {
      opts.log("版の復元に失敗しました: 以前の本体が見つかりません。");
      return;
    }
    try {
      await use(from, previousActive, opts.log);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      opts.log(`版の復元に失敗しました: ${message}`);
    }
  };
  if (!stillHere()) {
    opts.log("ワークスペースが閉じられたため、更新を中止しました。");
    return { ok: false, reason: "cancelled", target };
  }

  let switched = false;
  let machine = readInstall(target);
  if (needsNativeMachineInstall(machine, target)) {
    try {
      if (!stillHere()) {
        opts.log("ワークスペースが閉じられたため、更新を中止しました。");
        return { ok: false, reason: "cancelled", target };
      }
      await install(opts.log, undefined, fetch, target);
      switched = true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      opts.log(message);
      return { ok: false, reason: "install-failed", target };
    }
    machine = readInstall(target);
  } else {
    opts.log(`本体 ${machine?.version} は導入済みです。プロジェクトを設定します…`);
  }
  if (machine === null || needsNativeMachineInstall(machine, target)) {
    opts.log("本体の配置を確認できません。公式手順でインストール先を確認してください。");
    if (switched) await restoreActiveRuntime();
    return { ok: false, reason: "missing-binary", target };
  }
  let installed = machine;
  let pinned = false;
  let maybeApplied = false;

  const restore = async (restorePin: boolean): Promise<void> => {
    try {
      if (restorePin) {
        if (previousPin === null) await unpin(installed, opts.workspaceRoot, opts.log);
        else if (previousPin !== target)
          await pin(installed, opts.workspaceRoot, previousPin, opts.log);
      }
      if (previousActive !== null && previousActive !== target)
        await use(installed, previousActive, opts.log);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      opts.log(`版の復元に失敗しました: ${message}`);
    }
  };
  const cancel = async (): Promise<NativeWorkflowsUpdateResult> => {
    opts.log("ワークスペースが閉じられたため、更新を中止しました。");
    if (switched && folderWritable() && !maybeApplied) await restore(pinned);
    return { ok: false, reason: "cancelled", target };
  };

  try {
    if (!stillHere()) return await cancel();
    await use(installed, target, opts.log);
    switched = true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (!isIncompleteRetainedUseError(message)) {
      opts.log(message);
      return { ok: false, reason: "use-failed", target };
    }
    opts.log("導入済みの本体が不完全なため、公式インストーラーで修復します…");
    try {
      if (!stillHere()) return await cancel();
      await install(opts.log, undefined, fetch, target, { repair: true });
      switched = true;
    } catch (installCause) {
      const installMessage =
        installCause instanceof Error ? installCause.message : String(installCause);
      opts.log(installMessage);
      return { ok: false, reason: "install-failed", target };
    }
    machine = readInstall(target);
    if (machine === null || needsNativeMachineInstall(machine, target)) {
      opts.log("本体の配置を確認できません。公式手順でインストール先を確認してください。");
      await restoreActiveRuntime();
      return { ok: false, reason: "missing-binary", target };
    }
    installed = machine;
    try {
      if (!stillHere()) return await cancel();
      await use(installed, target, opts.log);
      switched = true;
    } catch (retryCause) {
      const retryMessage = retryCause instanceof Error ? retryCause.message : String(retryCause);
      opts.log(retryMessage);
      return { ok: false, reason: "use-failed", target };
    }
  }

  try {
    if (!stillHere()) return await cancel();
    await pin(installed, opts.workspaceRoot, target, opts.log);
    pinned = true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    opts.log(message);
    await restore(false);
    return { ok: false, reason: "pin-failed", target };
  }

  for (const harness of opts.selected) {
    try {
      if (!stillHere()) return await cancel();
      await configure(installed, opts.workspaceRoot, harness, opts.log, undefined, {
        mcp: "preserve",
        previewOnly: true,
        ...(opts.isCurrent ? { isCurrent: opts.isCurrent } : {}),
      });
    } catch (cause) {
      if (!stillHere()) return await cancel();
      const message = cause instanceof Error ? cause.message : String(cause);
      opts.log(`${harness} の設定確認に失敗しました: ${message}`);
      await restore(true);
      return { ok: false, reason: "preflight", target };
    }
  }

  const failed: HarnessId[] = [];
  // Each apply plans again: earlier tools may legitimately change shared root files,
  // invalidating the tokens from the all-tools preflight above.
  for (const harness of opts.selected) {
    try {
      if (!stillHere()) return await cancel();
      const result = await configure(installed, opts.workspaceRoot, harness, opts.log, undefined, {
        mcp: "preserve",
        ...(opts.isCurrent ? { isCurrent: opts.isCurrent } : {}),
        onApplyStart: () => {
          maybeApplied = true;
        },
      });
      const diagnosticDetails = result.doctorReport
        ? formatDoctorDetailsForLog(result.doctorReport)
        : result.details;
      if (diagnosticDetails.trim()) opts.log(`${harness} の診断結果:\n${diagnosticDetails}`);
      if (!result.doctorOk) {
        opts.log(
          `${harness} を設定しました。診断に追加の対応項目があります。詳細を確認してください。`,
        );
      }
    } catch (cause) {
      if (!stillHere()) return await cancel();
      const message = cause instanceof Error ? cause.message : String(cause);
      opts.log(`${harness} の設定に失敗しました: ${message}`);
      failed.push(harness);
    }
  }
  if (failed.length === opts.selected.length) await restore(true);
  if (failed.length > 0) {
    return { ok: false, reason: failed.join(", "), target };
  }
  return { ok: true, target };
}
