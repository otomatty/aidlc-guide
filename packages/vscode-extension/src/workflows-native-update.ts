import type { HarnessId } from "./harness-detect.ts";
import {
  configureNative,
  installNative,
  type NativeInstall,
  readVersionedNativeInstall,
  SETUP_RELEASE,
} from "./native-setup.ts";
import { parseSemver } from "./update-release.ts";

export type NativeWorkflowsUpdateResult = {
  ok: boolean;
  reason?: string;
  target: string;
};

export type NativeWorkflowsUpdateHooks = {
  readInstall?: (version: string) => NativeInstall | null;
  install?: typeof installNative;
  configure?: typeof configureNative;
};

/**
 * Machine runtime for a native (2.8+) docs pin: always the Setup bootstrap
 * release. Docs `sourceVersion` moves on every upstream commit and usually has
 * no GitHub release tag, so the pin is never used as an installer version.
 */
export function nativeUpdateRelease(pin: string): string | null {
  const pinVersion = parseSemver(pin);
  if (pinVersion === null || pinVersion.prerelease !== "") return null;
  return SETUP_RELEASE;
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
  const target = nativeUpdateRelease(opts.pin);
  if (target === null) {
    opts.log("Guide の想定版が読めません。公式手順から手動で更新してください。");
    return { ok: false, reason: "pin-invalid", target: opts.pin };
  }
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
