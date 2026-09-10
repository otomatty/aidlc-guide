import type { HarnessId } from "./harness-detect.ts";
import {
  configureNative,
  installNative,
  type NativeInstall,
  pinNative,
  readVersionedNativeInstall,
  SETUP_RELEASE,
  useNative,
} from "./native-setup.ts";
import { compareSemver, parseSemver } from "./update-release.ts";

export type NativeWorkflowsUpdateResult = {
  ok: boolean;
  reason?: string;
  target: string;
};

export type NativeWorkflowsUpdateHooks = {
  readInstall?: (version: string) => NativeInstall | null;
  install?: typeof installNative;
  use?: typeof useNative;
  pin?: typeof pinNative;
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

export async function applyNativeWorkflowsUpdate(opts: {
  workspaceRoot: string;
  pin: string;
  selected: HarnessId[];
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

  const readInstall = opts.hooks?.readInstall ?? readVersionedNativeInstall;
  const install = opts.hooks?.install ?? installNative;
  const use = opts.hooks?.use ?? useNative;
  const pin = opts.hooks?.pin ?? pinNative;
  const configure = opts.hooks?.configure ?? configureNative;

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

  try {
    await use(machine, target, opts.log);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    opts.log(message);
    return { ok: false, reason: "use-failed", target };
  }

  try {
    await pin(machine, opts.workspaceRoot, target, opts.log);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    opts.log(message);
    return { ok: false, reason: "pin-failed", target };
  }

  const failed: HarnessId[] = [];
  for (const harness of opts.selected) {
    try {
      const result = await configure(machine, opts.workspaceRoot, harness, opts.log, undefined, {
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
  if (failed.length > 0) {
    return { ok: false, reason: failed.join(", "), target };
  }
  return { ok: true, target };
}
