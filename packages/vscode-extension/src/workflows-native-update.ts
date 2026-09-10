import type { HarnessId } from "./harness-detect.ts";
import {
  configureNative,
  installNative,
  type NativeInstall,
  pinNative,
  readNativeInstall,
  readProjectPin,
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
    return parsed !== null && parsed.prerelease === "" && compareSemver(parsed, targetVersion) > 0;
  });
}

/**
 * Harnesses that must take part in a native update. Copilot and opencode share
 * `.aidlc/`, so selecting one of those two satisfies the other when both are
 * present; every other detected projection has to stay selected.
 */
export function omittedRequiredHarnesses(
  detected: HarnessId[],
  selected: HarnessId[],
): HarnessId[] {
  return detected.filter((id) => {
    if (selected.includes(id)) return false;
    if (id === "copilot" && selected.includes("opencode")) return false;
    if (id === "opencode" && selected.includes("copilot")) return false;
    return true;
  });
}

export async function applyNativeWorkflowsUpdate(opts: {
  workspaceRoot: string;
  pin: string;
  selected: HarnessId[];
  detected?: HarnessId[];
  log: (line: string) => void;
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
  if (opts.selected.includes("copilot") && opts.selected.includes("opencode")) {
    opts.log(
      "Copilot と opencode はどちらも .aidlc/ を使うため、同時には更新しません。どちらか一方のチェックを外してください。",
    );
    return { ok: false, reason: "collision", target };
  }
  const omitted = omittedRequiredHarnesses(opts.detected ?? opts.selected, opts.selected);
  if (omitted.length > 0) {
    opts.log(
      "検出されたハーネスはすべて同じ版に揃えます。一部だけ外すとプロジェクトが使えなくなるため、外さずに更新してください。",
    );
    return { ok: false, reason: "incomplete-selection", target };
  }

  const readInstall = opts.hooks?.readInstall ?? readVersionedNativeInstall;
  const readActive = opts.hooks?.readActive ?? readNativeInstall;
  const readPin = opts.hooks?.readProjectPin ?? readProjectPin;
  const readWorkspaceVersions =
    opts.hooks?.readWorkspaceVersions ??
    ((root: string) => readAllWorkspaceAidlcVersions(root).map((item) => item.version));
  const install = opts.hooks?.install ?? installNative;
  const use = opts.hooks?.use ?? useNative;
  const pin = opts.hooks?.pin ?? pinNative;
  const unpin = opts.hooks?.unpin ?? unpinNative;
  const configure = opts.hooks?.configure ?? configureNative;
  const previousActive = readActive()?.version ?? null;
  const previousPin = readPin(opts.workspaceRoot);
  if (
    wouldDowngradeWorkspace([...readWorkspaceVersions(opts.workspaceRoot), previousPin], target)
  ) {
    opts.log(
      `このワークスペースには本体 ${target} より新しいハーネスまたは固定版があるため、自動更新はダウングレードになります。公式手順から手動で更新してください。`,
    );
    return { ok: false, reason: "would-downgrade", target };
  }

  let machine = readInstall(target);
  if (needsNativeMachineInstall(machine, target)) {
    try {
      await install(opts.log, undefined, fetch, target);
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
    return { ok: false, reason: "missing-binary", target };
  }
  const installed = machine;

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

  try {
    await use(installed, target, opts.log);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    opts.log(message);
    return { ok: false, reason: "use-failed", target };
  }

  try {
    await pin(installed, opts.workspaceRoot, target, opts.log);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    opts.log(message);
    await restore(false);
    return { ok: false, reason: "pin-failed", target };
  }

  for (const harness of opts.selected) {
    try {
      await configure(installed, opts.workspaceRoot, harness, opts.log, undefined, {
        mcp: "preserve",
        previewOnly: true,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      opts.log(`${harness} の設定確認に失敗しました: ${message}`);
      await restore(true);
      return { ok: false, reason: "preflight", target };
    }
  }

  const failed: HarnessId[] = [];
  for (const harness of opts.selected) {
    try {
      const result = await configure(installed, opts.workspaceRoot, harness, opts.log, undefined, {
        mcp: "preserve",
      });
      if (!result.doctorOk) {
        opts.log(
          `${harness} を設定しました。診断に追加の対応項目があります。詳細を確認してください。`,
        );
      }
    } catch (cause) {
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
