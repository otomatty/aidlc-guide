import { accessSync, constants, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { detectHarnesses } from "./harness-detect.ts";
import { assertNoActiveWorkflows } from "./native-harness-install.ts";
import { readNativeProjections } from "./native-projection.ts";
import {
  inspectProjectPin,
  installLocations,
  installNative,
  type NativeInstall,
  pinNative,
  readNativeInstall,
  readVersionedNativeInstall,
  SETUP_RELEASE,
  useNative,
} from "./native-setup.ts";
import { compareSemver, parseSemver } from "./update-release.ts";
import { acquireWorkflowsOperation, WORKFLOWS_BUSY_MESSAGE } from "./workflows-operation.ts";
import { harnessVersionRel, readAllWorkspaceAidlcVersions } from "./workflows-version.ts";

export type CliManagementHooks = {
  inspectPin?: typeof inspectProjectPin;
  readWorkspaceVersions?: (root: string) => (string | null)[];
  readActive?: typeof readNativeInstall;
  readInstall?: typeof readVersionedNativeInstall;
  install?: typeof installNative;
  use?: typeof useNative;
  pin?: typeof pinNative;
  readPinBytes?: (root: string) => Uint8Array;
  writePinBytes?: (root: string, bytes: Uint8Array) => void;
  launcherReady?: (install: NativeInstall | null) => boolean;
};

export type CliManagementState = {
  machineVersion: string | null;
  projectPin: string | null;
  projectVersion: string | null;
  effectiveVersion: string | null;
  target: string;
  targetInstalled: boolean;
  launcherReady: boolean;
  setupReady: boolean;
  canPrepare: boolean;
  canUpdate: boolean;
  /** Project specifies a different version; confirm before updating the machine CLI. */
  confirmUpdate: boolean;
  status: "ready" | "missing" | "blocked";
  message: string;
  updateMessage: string;
};

export const CLI_UPDATE_CONFIRM_ACTION = "更新する";

export function olderThanTarget(version: string | null | undefined): boolean {
  const installed = parseSemver(version ?? "");
  const target = parseSemver(SETUP_RELEASE);
  return installed !== null && target !== null && compareSemver(installed, target) < 0;
}

export function cliUpdateConfirmMessage(
  projectVersion: string,
  target: string = SETUP_RELEASE,
): string {
  return `このプロジェクトの固定バージョンは ${projectVersion} です。CLI を ${target} に更新しますか？\n固定バージョンは変更しません。`;
}

export type CliManagementResult = {
  ok: boolean;
  stage: "preflight" | "install" | "activate" | "register" | "verify" | "restore" | "complete";
  reason?: string;
  message: string;
  details: string;
  nextAction: string;
  recovery: "not-needed" | "restored" | "failed";
  /** Whether a runtime or a local registration may have been written. */
  applied: boolean;
};

export type CliManagementOptions = {
  workspaceRoot: string;
  log: (line: string) => void;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  hooks?: CliManagementHooks;
};

function workspaceVersions(root: string): (string | null)[] {
  const records = readAllWorkspaceAidlcVersions(root);
  const native = readNativeProjections(root);
  const missing = detectHarnesses(root).harnesses.filter(
    ({ id }) =>
      !native.some((entry) => entry.harness === id) &&
      !records.some((entry) => entry.sourcePath === path.join(root, harnessVersionRel(id))),
  );
  return [...records.map((entry) => entry.version), ...missing.map(() => null)];
}

function repositoryInputs(root: string, hooks: CliManagementHooks) {
  return {
    pin: (hooks.inspectPin ?? inspectProjectPin)(root),
    versions: (hooks.readWorkspaceVersions ?? workspaceVersions)(root),
  };
}

/** Only an unpinned workspace without engine metadata may initialize a new project. */
function isFreshProject(inputs: ReturnType<typeof repositoryInputs>): boolean {
  return !inputs.pin.exists && inputs.versions.length === 0;
}

/** Validate the command entry points as well as the binary checked by readNativeInstall. */
export function nativeLauncherReady(
  install: NativeInstall | null,
  platform: NodeJS.Platform = process.platform,
  installRoot = installLocations().root,
): boolean {
  if (!install) return false;
  try {
    const marker = readFileSync(path.join(installRoot, "active-version"), "utf8");
    if (![install.version, `${install.version}\n`, `${install.version}\r\n`].includes(marker))
      return false;
    const launchers =
      platform === "win32"
        ? [path.join(install.binDir, "aidlc.cmd"), path.join(installRoot, "aidlc-shim.ps1")]
        : [path.join(install.binDir, "aidlc")];
    for (const launcher of launchers) {
      const stat = statSync(launcher);
      if (!stat.isFile() || stat.size === 0) return false;
      accessSync(launcher, platform === "win32" ? constants.R_OK : constants.R_OK | constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function newerThanTarget(version: string | undefined): boolean {
  const installed = parseSemver(version ?? "");
  const target = parseSemver(SETUP_RELEASE);
  return installed !== null && target !== null && compareSemver(installed, target) > 0;
}

/** CLI readiness is separate from whether the repository needs an engine update. */
export function inspectCliManagement(
  root: string,
  hooks: CliManagementHooks = {},
): CliManagementState {
  const active = hooks.readActive ?? readNativeInstall;
  const machine = active();
  const effective = active(root);
  const inputs = repositoryInputs(root, hooks);
  const versions = [...new Set(inputs.versions)];
  const projectVersion = inputs.pin.version ?? (versions.length === 1 ? versions[0] : null) ?? null;
  const requested = projectVersion ?? SETUP_RELEASE;
  const newer = newerThanTarget(machine?.version);
  const targetInstalled = (hooks.readInstall ?? readVersionedNativeInstall)(SETUP_RELEASE) !== null;
  const launcherReady = (hooks.launcherReady ?? nativeLauncherReady)(machine);
  const canUpdate =
    !targetInstalled || !launcherReady || (!newer && machine?.version !== SETUP_RELEASE);
  const confirmUpdate = canUpdate && inputs.pin.exists && olderThanTarget(inputs.pin.version);
  const state: CliManagementState = {
    machineVersion: machine?.version ?? null,
    projectPin: inputs.pin.version,
    projectVersion,
    effectiveVersion: effective?.version ?? null,
    target: SETUP_RELEASE,
    targetInstalled,
    launcherReady,
    setupReady: false,
    canPrepare: false,
    canUpdate,
    confirmUpdate,
    status: "blocked",
    message: "",
    updateMessage: newer
      ? canUpdate
        ? `必要な実行環境 ${SETUP_RELEASE} を追加導入します。マシンの既定CLI ${machine?.version} とプロジェクトの固定バージョンは維持します。`
        : `実行環境 ${SETUP_RELEASE} は準備済みです。マシンの既定CLI ${machine?.version} を維持します。`
      : canUpdate
        ? `このマシンの既定CLIを ${SETUP_RELEASE} に更新します。バージョンを固定していない他のプロジェクトにも適用されます。`
        : `このマシンの既定CLIは ${SETUP_RELEASE} です。`,
  };
  if (inputs.pin.exists && inputs.pin.version === null)
    return {
      ...state,
      message: ".aidlc-version を読めません。ファイルの内容と権限を確認してください。",
    };
  if (versions.some((version) => version === null || !parseSemver(version)))
    return {
      ...state,
      message:
        "リポジトリ内のエンジンのバージョンを確認できません。更新画面で設定を確認してください。",
    };
  if (versions.length > 1 || versions.some((version) => version !== requested))
    return {
      ...state,
      message:
        "リポジトリ内のバージョンが一致していません。更新画面でエンジンと固定バージョンを確認してください。",
    };
  if (isFreshProject(inputs) && newer) {
    const ready = targetInstalled && launcherReady;
    return {
      ...state,
      setupReady: ready,
      canPrepare: !ready,
      status: ready ? "ready" : "missing",
      message: ready
        ? `新規プロジェクトの設定に使う CLI ${SETUP_RELEASE} は準備済みです。次の「プロジェクトを設定」でこのバージョンに固定します。マシンの既定CLI ${machine?.version} は維持します。`
        : `新規プロジェクト用に CLI ${SETUP_RELEASE} を追加導入します。マシンの既定CLI ${machine?.version} は維持し、プロジェクトの固定バージョンは次の設定時に作成します。`,
    };
  }
  if (
    launcherReady &&
    effective?.version === requested &&
    (requested !== SETUP_RELEASE || targetInstalled)
  )
    return {
      ...state,
      setupReady: true,
      status: "ready",
      message: inputs.pin.exists
        ? `プロジェクトの固定バージョン ${requested} をこのマシンで利用できます。`
        : `CLI ${requested} を利用できます。この既定バージョンは、バージョンを固定していない他のプロジェクトにも適用されます。`,
    };
  if (olderThanTarget(requested)) {
    const ready = targetInstalled && launcherReady;
    return {
      ...state,
      setupReady: ready,
      canPrepare: false,
      confirmUpdate: canUpdate && inputs.pin.exists && olderThanTarget(inputs.pin.version),
      status: ready ? "ready" : "missing",
      message: ready
        ? `このマシンの CLI を利用できます。プロジェクトの固定バージョン ${requested} は維持します。`
        : `このプロジェクトの固定バージョンは ${requested} です。Guide から導入できる CLI ${SETUP_RELEASE} を準備できます。固定バージョンは変更しません。`,
    };
  }
  if (requested !== SETUP_RELEASE)
    return {
      ...state,
      message: `このプロジェクトには CLI ${requested} が必要です。拡張から導入できるのは検証済みの ${SETUP_RELEASE} です。既存の固定バージョンを変更せず、公式手順で必要なCLIを用意してください。`,
    };
  if (!inputs.pin.exists && newer)
    return {
      ...state,
      message:
        "既定CLIがプロジェクトより新しいため、自動では切り替えません。プロジェクトの固定バージョンを確認してください。",
    };
  return {
    ...state,
    canPrepare: true,
    status: "missing",
    message: inputs.pin.exists
      ? `プロジェクトの固定バージョン ${requested} を導入し、このマシンに登録します。共有するバージョンは変更しません。`
      : `CLI ${requested} を導入してこのマシンの既定バージョンにします。バージョンを固定していない他のプロジェクトにも適用されます。`,
  };
}

function errorDetails(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Upstream registers the local pin and rewrites the shared pin with LF.
 * The filesystem-write exception in biome.json only permits restoring this
 * existing file's original bytes when its contents equal the known CLI output.
 * It does not create pins, change their version, or write engine files.
 */
async function registerExistingPin(
  opts: CliManagementOptions,
  runtime: NativeInstall,
): Promise<void> {
  const hooks = opts.hooks ?? {};
  const read =
    hooks.readPinBytes ?? ((root: string) => readFileSync(path.join(root, ".aidlc-version")));
  const write =
    hooks.writePinBytes ??
    ((root: string, bytes: Uint8Array) => writeFileSync(path.join(root, ".aidlc-version"), bytes));
  const original = Buffer.from(read(opts.workspaceRoot));
  if (original.toString("utf8").trim() !== SETUP_RELEASE)
    throw new Error(
      "登録直前に .aidlc-version が変わりました。再読み込みしてバージョンを確認してください。",
    );
  let registrationFailed = false;
  let registrationError: unknown;
  try {
    await (hooks.pin ?? pinNative)(
      runtime,
      opts.workspaceRoot,
      SETUP_RELEASE,
      opts.log,
      undefined,
      {
        ...(opts.signal ? { signal: opts.signal } : {}),
      },
    );
  } catch (cause) {
    registrationFailed = true;
    registrationError = cause;
  }
  try {
    // Cleanup also runs after cancellation and a command that committed before failing.
    const current = Buffer.from(read(opts.workspaceRoot));
    if (!current.equals(original)) {
      if (!current.equals(Buffer.from(`${SETUP_RELEASE}\n`)))
        throw new Error(
          "登録中に .aidlc-version が変更されました。外部の変更を上書きせずに停止しました。",
        );
      write(opts.workspaceRoot, original);
      if (!Buffer.from(read(opts.workspaceRoot)).equals(original))
        throw new Error(".aidlc-version の元の内容への復元を確認できません。");
    }
  } catch (cause) {
    throw new Error(
      [
        ...(registrationFailed ? [errorDetails(registrationError)] : []),
        "共有する .aidlc-version の内容を維持できませんでした。",
        errorDetails(cause),
      ].join("\n"),
    );
  }
  if (registrationFailed) throw registrationError;
}

function nextAction(stage: CliManagementResult["stage"], details: string): string {
  if (/進行中の AI-DLC ワークフロー/.test(details))
    return "進行中の AI-DLC ワークフローを完了してから、CLIの操作を再実行してください。";
  if (/\.aidlc-version/.test(details))
    return ".aidlc-version の差分と現在の固定バージョンを確認してください。外部の変更は上書きせず、CLI準備を再実行してください。";
  if (/チェックサム|checksum/i.test(details))
    return "検証に失敗したインストーラーは実行していません。公式配布元を確認して再取得してください。";
  if (/EACCES|EPERM|permission|アクセス.*拒否|権限|使用中/i.test(details))
    return "ログの対象パスの権限を確認し、使用中のプロセスを終了して再実行してください。";
  if (/fetch|HTTP|network|timeout|timed out|通信|取得|タイムアウト/i.test(details))
    return "通信環境とプロキシ設定を確認して再試行してください。取得済みの本体は再検査します。";
  if (stage === "register")
    return "CLI本体と固定バージョンの登録状況を確認し、セットアップのCLI準備を再実行してください。";
  return "画面を再読み込みして現在のバージョンを確認し、ログの原因を解消して再実行してください。";
}

async function manageCli(
  opts: CliManagementOptions,
  mode: "prepare" | "update",
): Promise<CliManagementResult> {
  const hooks = opts.hooks ?? {};
  const active = hooks.readActive ?? readNativeInstall;
  const retained = hooks.readInstall ?? readVersionedNativeInstall;
  const launcherReady = hooks.launcherReady ?? nativeLauncherReady;
  const use = hooks.use ?? useNative;
  const current = () => !opts.signal?.aborted && opts.isCurrent?.() !== false;
  const checkCurrent = () => {
    if (!current()) throw new Error("CLIの準備を中止しました。");
  };
  let stage: CliManagementResult["stage"] = "preflight";
  const assertCanChangeRuntime = async () => {
    stage = "preflight";
    await assertNoActiveWorkflows(opts.workspaceRoot);
    checkCurrent();
  };
  let applied = false;
  let previous: NativeInstall | null = null;
  const result = (
    ok: boolean,
    message: string,
    details = "",
    reason?: string,
  ): CliManagementResult => ({
    ok,
    stage,
    ...(reason ? { reason } : {}),
    message,
    details,
    nextAction: ok ? "aidlc doctor を実行して環境を確認してください。" : nextAction(stage, details),
    recovery: "not-needed",
    applied,
  });
  const release = acquireWorkflowsOperation(opts.workspaceRoot);
  if (!release) return result(false, WORKFLOWS_BUSY_MESSAGE, "", "busy");
  let outcome: CliManagementResult;
  let preserveDefault = false;
  try {
    checkCurrent();
    previous = active();
    const inputs = repositoryInputs(opts.workspaceRoot, hooks);
    const state = inspectCliManagement(opts.workspaceRoot, hooks);
    preserveDefault =
      (mode === "prepare" && inputs.pin.exists) ||
      (newerThanTarget(previous?.version) && (mode === "update" || isFreshProject(inputs)));
    if ((mode === "prepare" && state.setupReady) || (mode === "update" && !state.canUpdate)) {
      const ok = mode === "prepare" || (state.targetInstalled && state.launcherReady);
      release();
      return result(
        ok,
        mode === "prepare" ? state.message : state.updateMessage,
        "",
        ok ? undefined : "blocked",
      );
    }
    if (mode === "prepare" && !state.canPrepare) {
      release();
      return result(false, state.message, "", "blocked");
    }

    let runtime = retained(SETUP_RELEASE);
    if (!runtime || !active() || !launcherReady(active())) {
      await assertCanChangeRuntime();
      stage = "install";
      // Installers can change the active pointer before reporting failure.
      applied = true;
      await (hooks.install ?? installNative)(opts.log, undefined, undefined, SETUP_RELEASE, {
        ...(opts.signal ? { signal: opts.signal } : {}),
        isCurrent: current,
      });
      checkCurrent();
      runtime = retained(SETUP_RELEASE);
      if (!runtime) throw new Error(`導入後の CLI ${SETUP_RELEASE} を確認できません。`);
    }
    if (mode === "prepare") {
      stage = "preflight";
      checkCurrent();
      if (JSON.stringify(inputs) !== JSON.stringify(repositoryInputs(opts.workspaceRoot, hooks)))
        throw new Error(
          "準備中にリポジトリの固定バージョンまたはエンジンのバージョンが変わりました。共有設定の変更は行っていません。",
        );
    }
    if (mode === "prepare" && inputs.pin.exists) {
      if (active(opts.workspaceRoot)?.version !== inputs.pin.version) {
        await assertCanChangeRuntime();
        stage = "register";
        checkCurrent();
        applied = true;
        await registerExistingPin(opts, runtime);
      }
    } else if (!preserveDefault && active()?.version !== SETUP_RELEASE) {
      await assertCanChangeRuntime();
      stage = "activate";
      checkCurrent();
      applied = true;
      await use(runtime, SETUP_RELEASE, opts.log, undefined, {
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
    }
    stage = "verify";
    checkCurrent();
    if (mode === "prepare") {
      if (JSON.stringify(inputs) !== JSON.stringify(repositoryInputs(opts.workspaceRoot, hooks)))
        throw new Error(
          "準備中にリポジトリのバージョンが変わりました。再読み込みしてバージョンを確認してください。",
        );
      if (!inspectCliManagement(opts.workspaceRoot, hooks).setupReady)
        throw new Error("このプロジェクトでCLIを利用できることを確認できません。");
    } else if (
      (!preserveDefault && active()?.version !== SETUP_RELEASE) ||
      !retained(SETUP_RELEASE) ||
      !launcherReady(active())
    ) {
      throw new Error("CLIの既定バージョンの切り替えを確認できません。");
    }
    stage = "complete";
    outcome = result(
      true,
      mode === "prepare"
        ? "このプロジェクトでCLIを利用する準備ができました。"
        : preserveDefault
          ? `実行環境 ${SETUP_RELEASE} を追加導入しました。マシンの既定CLI ${previous?.version} は維持しています。`
          : `このマシンの既定CLIを ${SETUP_RELEASE} に更新しました。`,
    );
  } catch (cause) {
    const details = errorDetails(cause);
    opts.log(details);
    outcome = result(
      false,
      current() ? "CLIの操作を完了できませんでした。" : "CLIの操作を中止しました。",
      details,
      current() ? `${stage}-failed` : "cancelled",
    );
  }
  try {
    if ((preserveDefault || !outcome.ok) && previous && active()?.version !== previous.version) {
      // Restore the machine even if cancellation closed the original project panel.
      await use(previous, previous.version, opts.log);
      if (active()?.version !== previous.version)
        throw new Error(`以前の既定CLI ${previous.version} への復元を確認できません。`);
      outcome.recovery = "restored";
    }
    if (outcome.ok && !current())
      outcome = {
        ...result(
          false,
          "CLIの操作を中止しました。",
          "現在のバージョンを確認してから再実行してください。",
          "cancelled",
        ),
        recovery: outcome.recovery,
      };
    if (
      outcome.ok &&
      mode === "prepare" &&
      !inspectCliManagement(opts.workspaceRoot, hooks).setupReady
    )
      outcome = {
        ...result(
          false,
          "CLIの準備状態を確認できません。",
          "既定バージョンの復元後にプロジェクトのCLIを利用できません。",
          "verification-failed",
        ),
        stage: "verify",
        recovery: outcome.recovery,
      };
    if (
      outcome.ok &&
      mode === "update" &&
      (!retained(SETUP_RELEASE) ||
        !launcherReady(active()) ||
        active()?.version !== (preserveDefault ? previous?.version : SETUP_RELEASE))
    )
      outcome = {
        ...result(
          false,
          "CLIの準備状態を確認できません。",
          "実行環境の対象バージョンと、マシンの既定バージョンを確認してください。",
          "verification-failed",
        ),
        stage: "verify",
        recovery: outcome.recovery,
      };
  } catch (cause) {
    const details = [outcome.details, errorDetails(cause)].filter(Boolean).join("\n");
    opts.log(details);
    outcome = {
      ...outcome,
      ok: false,
      stage: "restore",
      reason: "restore-failed",
      message: "以前の既定CLIへの復元に失敗しました。",
      details,
      recovery: "failed",
      nextAction: `ログとマシンの既定バージョンを確認し、公式CLIの aidlc use ${previous?.version ?? "<version>"} で復元してください。`,
    };
  } finally {
    release();
  }
  return outcome;
}

/** Prepare only this machine. An existing shared pin keeps its current version. */
export const prepareProjectCli = (opts: CliManagementOptions): Promise<CliManagementResult> =>
  manageCli(opts, "prepare");

/** Prepare the target runtime, preserving a newer default and all project configuration. */
export const updateMachineCli = (opts: CliManagementOptions): Promise<CliManagementResult> =>
  manageCli(opts, "update");
