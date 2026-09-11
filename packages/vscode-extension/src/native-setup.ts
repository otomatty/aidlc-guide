import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { CODEX_GIT_REQUIRED, isGitRepository } from "./git-prerequisite.ts";
import type { HarnessId } from "./harness-detect.ts";

/** Bootstrap release, independent of the version of the bundled reference docs. */
export const SETUP_RELEASE = "2.8.1";
export const INSTALL_GUIDE_URL = `https://github.com/awslabs/aidlc-workflows/releases/tag/v${SETUP_RELEASE}`;
const RELEASE_BASE = "https://github.com/awslabs/aidlc-workflows/releases";
const STRICT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export type NativeInstall = { executable: string; version: string; binDir: string };

export function installLocations(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): { root: string; binDir: string } {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const root =
    env.AIDLC_INSTALL_ROOT ||
    (platform === "win32"
      ? paths.join(env.LOCALAPPDATA || paths.join(home, "AppData", "Local"), "aidlc")
      : paths.join(env.XDG_DATA_HOME || paths.join(home, ".local", "share"), "aidlc"));
  return {
    root,
    binDir:
      env.AIDLC_BIN_DIR ||
      (platform === "win32" ? paths.join(root, "bin") : paths.join(home, ".local", "bin")),
  };
}

/** Resolve the active binary, or a registered project pin, within the machine install. */
export function readNativeInstall(projectRoot?: string): NativeInstall | null {
  const { root, binDir } = installLocations();
  try {
    // v2.8.1's stable launcher starts the active binary before dispatching a project pin.
    // A retained pin alone cannot make the normal `aidlc` command usable.
    const executable = readFileSync(path.join(root, "active-executable"), "utf8").trim();
    const version = path.basename(path.dirname(executable));
    const expected = path.join(
      root,
      "versions",
      version,
      process.platform === "win32" ? "aidlc.exe" : "aidlc",
    );
    if (
      !STRICT_VERSION.test(version) ||
      !path.isAbsolute(executable) ||
      !existsSync(expected) ||
      realpathSync(executable) !== realpathSync(expected)
    )
      return null;
    if (!statSync(expected).isFile()) return null;
    if (process.platform !== "win32") accessSync(expected, constants.X_OK);
    if (projectRoot && existsSync(path.join(projectRoot, ".aidlc-version"))) {
      const pinned = readFileSync(path.join(projectRoot, ".aidlc-version"), "utf8").trim();
      if (!STRICT_VERSION.test(pinned)) return null;
      const pinnedExecutable = path.join(root, "versions", pinned, path.basename(expected));
      const target = readFileSync(
        path.join(projectRoot, "aidlc", ".aidlc-sessions", "pin-target"),
        "utf8",
      );
      if (!/^[^\r\n]+\r?\n?$/.test(target)) return null;
      const targetPath = target.replace(/\r?\n$/, "");
      if (
        !path.isAbsolute(targetPath) ||
        realpathSync(targetPath) !== realpathSync(pinnedExecutable) ||
        !statSync(pinnedExecutable).isFile()
      )
        return null;
      if (process.platform !== "win32") accessSync(pinnedExecutable, constants.X_OK);
      const registry: unknown = JSON.parse(readFileSync(path.join(root, "pins.json"), "utf8"));
      if (!registry || typeof registry !== "object" || Array.isArray(registry)) return null;
      const projectPath = realpathSync(projectRoot);
      const registered = Object.entries(registry).filter(([candidate]) => {
        try {
          return realpathSync(candidate) === projectPath;
        } catch {
          return false;
        }
      });
      if (registered.length === 0 || registered.some(([, value]) => value !== pinned)) return null;
      return { executable: realpathSync(pinnedExecutable), version: pinned, binDir };
    }
    return { executable: realpathSync(expected), version, binDir };
  } catch {
    return null;
  }
}

/**
 * A retained version is complete only when the executable, version.json, and
 * runtime tree are all present. An interrupted installer can leave the binary
 * behind; `aidlc use` then fails closed instead of repairing.
 */
function isCompleteRetainedRelease(
  versionRoot: string,
  version: string,
  executable: string,
): boolean {
  try {
    if (!existsSync(executable) || !statSync(executable).isFile()) return false;
    if (process.platform !== "win32") accessSync(executable, constants.X_OK);
    const manifest: unknown = JSON.parse(
      readFileSync(path.join(versionRoot, "version.json"), "utf8"),
    );
    if (
      manifest === null ||
      typeof manifest !== "object" ||
      Array.isArray(manifest) ||
      !("schemaVersion" in manifest) ||
      !("version" in manifest) ||
      !("assets" in manifest)
    )
      return false;
    if (
      manifest.schemaVersion !== 1 ||
      manifest.version !== version ||
      !Array.isArray(manifest.assets)
    )
      return false;
    const digest = createHash("sha256").update(readFileSync(executable)).digest("hex");
    const assetMatches = manifest.assets.some((asset) => {
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) return false;
      return "sha256" in asset && asset.sha256 === digest;
    });
    if (!assetMatches) return false;
    const runtime = path.join(versionRoot, "runtime");
    return existsSync(runtime) && statSync(runtime).isDirectory();
  } catch {
    return false;
  }
}

/** Resolve one installed version directory, independent of the active pointer. */
export function readVersionedNativeInstall(version: string): NativeInstall | null {
  if (!STRICT_VERSION.test(version)) return null;
  const { root, binDir } = installLocations();
  try {
    const executable = path.join(
      root,
      "versions",
      version,
      process.platform === "win32" ? "aidlc.exe" : "aidlc",
    );
    if (!isCompleteRetainedRelease(path.dirname(executable), version, executable)) return null;
    return { executable: realpathSync(executable), version, binDir };
  } catch {
    return null;
  }
}

export type ProcessResult = { code: number; stdout: string; stderr: string };
export type SetupRunner = (
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  signal?: AbortSignal,
) => Promise<ProcessResult>;

export const runSetupProcess: SetupRunner = async (
  command,
  args,
  cwd,
  env = process.env,
  signal,
) => {
  signal?.throwIfAborted();
  return new Promise((resolve) => {
    let result: ProcessResult | undefined;
    const child = execFile(
      command,
      args,
      {
        cwd,
        env,
        signal,
        windowsHide: true,
        timeout: 600_000,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        result = {
          code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
          stdout,
          stderr: stderr || error?.message || "",
        };
      },
    );
    // Abort reports an error before the child exits. Keep the folder busy until it has stopped.
    child.once("close", () =>
      resolve(
        result ?? { code: 1, stdout: "", stderr: "プロセスの実行結果を取得できませんでした。" },
      ),
    );
    child.stdin?.end();
  });
};

function resultMessage(result: ProcessResult): string {
  try {
    const json = JSON.parse(result.stdout.trim());
    return (
      [json.message, json.remediation].filter((v) => typeof v === "string").join("\n") ||
      result.stdout
    );
  } catch {
    return [result.stdout, result.stderr].filter(Boolean).join("\n");
  }
}

function nativeCommandEnv(install: NativeInstall): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = `${install.binDir}${path.delimiter}${env[pathKey] ?? ""}`;
  return env;
}

async function downloadSmall(url: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok)
    throw new Error(`公式インストーラーの取得に失敗しました（HTTP ${response.status}）。`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 1024 * 1024) throw new Error("インストーラーのサイズが上限を超えています。");
  return bytes;
}

export function verifyInstaller(bytes: Uint8Array, checksums: string, filename: string): void {
  const rows = checksums
    .split(/\r?\n/)
    .filter((row) => row.slice(66) === filename && /^[a-f0-9]{64} {2}/.test(row));
  if (
    rows.length !== 1 ||
    rows[0]?.slice(0, 64) !== createHash("sha256").update(bytes).digest("hex")
  )
    throw new Error("公式インストーラーのチェックサムが一致しません。");
}

export async function installNative(
  log: (message: string) => void,
  runner: SetupRunner = runSetupProcess,
  fetchImpl: typeof fetch = fetch,
  version: string = SETUP_RELEASE,
): Promise<void> {
  if (!STRICT_VERSION.test(version)) throw new Error("導入する版を解釈できません。");
  if (
    !(
      (process.platform === "win32" && process.arch === "x64") ||
      (["darwin", "linux"].includes(process.platform) && ["x64", "arm64"].includes(process.arch))
    )
  )
    throw new Error("この OS / CPU 向けの公式インストーラーはありません。");
  const filename = process.platform === "win32" ? "install.ps1" : "install.sh";
  const base = `${RELEASE_BASE}/download/v${version}`;
  log(`AI-DLC ${version} の公式インストーラーを取得しています…`);
  const [bytes, checksums] = await Promise.all([
    downloadSmall(`${base}/${filename}`, fetchImpl),
    downloadSmall(`${base}/checksums.txt`, fetchImpl),
  ]);
  verifyInstaller(bytes, new TextDecoder().decode(checksums), filename);
  const temporary = await mkdtemp(path.join(tmpdir(), "aidlc-guide-install-"));
  try {
    const script = path.join(temporary, filename);
    await writeFile(script, bytes);
    log("本体と各ツール向けのランタイムをインストールしています。数分かかる場合があります…");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      AIDLC_RELEASE_REPOSITORY: "awslabs/aidlc-workflows",
      AIDLC_RELEASE_BASE_URL: RELEASE_BASE,
      AIDLC_RELEASE_WORKFLOW: "awslabs/aidlc-workflows/.github/workflows/release.yml",
      AIDLC_GUIDE_INSTALL_SCRIPT: script,
      AIDLC_GUIDE_INSTALL_VERSION: version,
    };
    delete env.AIDLC_ALLOW_ADMIN_INSTALL;
    // PowerShell 7's inherited module path can hide Windows PowerShell's built-in Get-FileHash.
    for (const key of Object.keys(env)) if (key.toLowerCase() === "psmodulepath") delete env[key];
    const result =
      process.platform === "win32"
        ? await runner(
            "powershell.exe",
            [
              "-NoProfile",
              "-NonInteractive",
              "-ExecutionPolicy",
              "Bypass",
              "-Command",
              "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; & $env:AIDLC_GUIDE_INSTALL_SCRIPT -Version $env:AIDLC_GUIDE_INSTALL_VERSION -Yes -Json; exit $LASTEXITCODE",
            ],
            temporary,
            env,
          )
        : await runner(
            "/bin/sh",
            [script, "--version", version, "--yes", "--json"],
            temporary,
            env,
          );
    log(resultMessage(result));
    if (result.code !== 0)
      throw new Error(resultMessage(result) || "本体のインストールに失敗しました。");
  } finally {
    // Only the unique temporary directory created above is removed.
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function useNative(
  install: NativeInstall,
  version: string,
  log: (message: string) => void,
  runner: SetupRunner = runSetupProcess,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (!STRICT_VERSION.test(version)) throw new Error("切り替える版を解釈できません。");
  options.signal?.throwIfAborted();
  log(`本体 ${version} をこのマシンの既定版にします…`);
  const result = await runner(
    install.executable,
    ["use", version],
    install.binDir,
    nativeCommandEnv(install),
    options.signal,
  );
  log(resultMessage(result));
  if (result.code !== 0) throw new Error(resultMessage(result) || "本体の切り替えに失敗しました。");
}

export async function pinNative(
  install: NativeInstall,
  root: string,
  version: string,
  log: (message: string) => void,
  runner: SetupRunner = runSetupProcess,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (!STRICT_VERSION.test(version)) throw new Error("固定する版を解釈できません。");
  options.signal?.throwIfAborted();
  log(`プロジェクトを本体 ${version} に固定します…`);
  const result = await runner(
    install.executable,
    ["config", "--pin", version, "--project-dir", root],
    root,
    nativeCommandEnv(install),
    options.signal,
  );
  log(resultMessage(result));
  if (result.code !== 0)
    throw new Error(resultMessage(result) || "プロジェクトの版の固定に失敗しました。");
}

export type ProjectPinState = {
  exists: boolean;
  version: string | null;
};

function isMissingFile(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code: unknown }).code === "ENOENT"
  );
}

export function inspectProjectPin(root: string): ProjectPinState {
  try {
    const pinned = readFileSync(path.join(root, ".aidlc-version"), "utf8").trim();
    return { exists: true, version: STRICT_VERSION.test(pinned) ? pinned : null };
  } catch (cause) {
    return { exists: !isMissingFile(cause), version: null };
  }
}

export function readProjectPin(root: string): string | null {
  return inspectProjectPin(root).version;
}

export async function unpinNative(
  install: NativeInstall,
  root: string,
  log: (message: string) => void,
  runner: SetupRunner = runSetupProcess,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  options.signal?.throwIfAborted();
  log("プロジェクトの版の固定を解除します…");
  const result = await runner(
    install.executable,
    ["config", "--unpin", "--project-dir", root],
    root,
    nativeCommandEnv(install),
    options.signal,
  );
  log(resultMessage(result));
  if (result.code !== 0)
    throw new Error(resultMessage(result) || "プロジェクトの版の固定の解除に失敗しました。");
}

export type NativeConfigureResult = {
  doctorOk: boolean;
  details: string;
  planToken?: string;
};

export type ConfigureNativeOptions = {
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  mcp?: "none" | "preserve";
  previewOnly?: boolean;
  planToken?: string;
};

export async function configureNative(
  install: NativeInstall,
  root: string,
  harness: HarnessId,
  log: (message: string) => void,
  runner: SetupRunner = runSetupProcess,
  options: ConfigureNativeOptions = {},
): Promise<NativeConfigureResult> {
  const { signal, isCurrent, mcp = "none", previewOnly = false, planToken } = options;
  if (previewOnly && planToken !== undefined)
    throw new Error("設定の確認と適用を同時には指定できません。");
  const checkCurrent = () => {
    signal?.throwIfAborted();
    if (isCurrent && !isCurrent()) throw new Error("プロジェクトの設定を中止しました。");
  };
  checkCurrent();
  if (harness === "codex") {
    const gitReady = await isGitRepository(root, signal);
    checkCurrent();
    if (!gitReady) throw new Error(CODEX_GIT_REQUIRED);
  }
  const args = ["config", "--project-dir", root, "--harness", harness];
  switch (mcp) {
    case "preserve":
      break;
    case "none":
      args.push("--mcp", "none");
      break;
    default: {
      const _never: never = mcp;
      throw new Error(`未対応の MCP 指定です: ${_never}`);
    }
  }
  const env = nativeCommandEnv(install);
  let token = planToken;
  if (token === undefined) {
    log("プロジェクトへの設定内容を確認しています…");
    checkCurrent();
    const preview = await runner(
      install.executable,
      [...args, "--dry-run", "--json"],
      root,
      env,
      signal,
    );
    checkCurrent();
    if (preview.code !== 0) throw new Error(resultMessage(preview));
    const plan: unknown = JSON.parse(preview.stdout.trim());
    const previewToken = (plan as { data?: { planToken?: unknown } })?.data?.planToken;
    if (typeof previewToken !== "string" || previewToken.length === 0)
      throw new Error("設定計画を取得できませんでした。");
    token = previewToken;
    if (previewOnly) return { doctorOk: true, details: resultMessage(preview), planToken: token };
  } else if (token.length === 0) {
    throw new Error("設定計画を取得できませんでした。");
  }
  log("選択したツール向けにプロジェクトを設定しています…");
  checkCurrent();
  const applied = await runner(
    install.executable,
    [...args, "--plan-token", token, "--json"],
    root,
    env,
    signal,
  );
  checkCurrent();
  log(resultMessage(applied));
  if (applied.code !== 0) throw new Error(resultMessage(applied));
  log("設定後の環境を診断しています…");
  checkCurrent();
  const doctor = await runner(install.executable, ["doctor"], root, env, signal);
  checkCurrent();
  const details = [doctor.stdout, doctor.stderr].filter(Boolean).join("\n");
  log(details);
  return { doctorOk: doctor.code === 0, details, planToken: token };
}
