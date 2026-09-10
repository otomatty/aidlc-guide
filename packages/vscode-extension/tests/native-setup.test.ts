import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const git = vi.hoisted(() => vi.fn());
vi.mock("../src/git-prerequisite.ts", async (original) => ({
  ...(await original<typeof import("../src/git-prerequisite.ts")>()),
  isGitRepository: git,
}));
beforeEach(() => git.mockResolvedValue(true));

import {
  configureNative,
  installLocations,
  installNative,
  readNativeInstall,
  runSetupProcess,
  SETUP_RELEASE,
  type SetupRunner,
  verifyInstaller,
} from "../src/native-setup.ts";

const ok = { code: 0, stdout: JSON.stringify({ ok: true, message: "configured" }), stderr: "" };
const plan = { ...ok, stdout: JSON.stringify({ ok: true, data: { planToken: "exact-plan" } }) };
const native = { executable: "/user/aidlc", version: "2.8.1", binDir: "/user/bin" };
const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native setup", () => {
  it("resolves per-user Windows, macOS, and overridden install directories", () => {
    expect(
      installLocations("win32", { LOCALAPPDATA: "C:\\Users\\test\\Local" }, "C:\\Users\\test"),
    ).toEqual({
      root: "C:\\Users\\test\\Local\\aidlc",
      binDir: "C:\\Users\\test\\Local\\aidlc\\bin",
    });
    expect(installLocations("darwin", {}, "/Users/test").root).toBe(
      "/Users/test/.local/share/aidlc",
    );
    expect(
      installLocations(
        "linux",
        { XDG_DATA_HOME: "/data", AIDLC_BIN_DIR: "/bin/custom" },
        "/home/test",
      ),
    ).toEqual({ root: "/data/aidlc", binDir: "/bin/custom" });
  });

  it("detects the verified placement without relying on a newly updated PATH", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-pointer-"));
    roots.push(root);
    vi.stubEnv("AIDLC_INSTALL_ROOT", root);
    const exe = path.join(
      root,
      "versions",
      "2.8.1",
      process.platform === "win32" ? "aidlc.exe" : "aidlc",
    );
    await mkdir(path.dirname(exe), { recursive: true });
    await writeFile(exe, "fixture", { mode: 0o755 });
    await writeFile(path.join(root, "active-executable"), `${exe}\n`);
    expect(readNativeInstall()?.version).toBe("2.8.1");
    await writeFile(path.join(root, "active-executable"), path.join(root, "untrusted.exe"));
    expect(readNativeInstall()).toBeNull();
  });

  it("resolves a registered retained pin instead of the different machine-active version", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-pin-"));
    roots.push(root);
    vi.stubEnv("AIDLC_INSTALL_ROOT", root);
    const project = path.join(root, "project");
    const marker = path.join(project, "aidlc", ".aidlc-sessions", "pin-target");
    await mkdir(path.dirname(marker), { recursive: true });
    const executableName = process.platform === "win32" ? "aidlc.exe" : "aidlc";
    const active = path.join(root, "versions", "2.8.2", executableName);
    const pinned = path.join(root, "versions", "2.8.1", executableName);
    for (const exe of [active, pinned]) {
      await mkdir(path.dirname(exe), { recursive: true });
      await writeFile(exe, "fixture", { mode: 0o755 });
    }
    await writeFile(path.join(root, "active-executable"), active);
    await writeFile(path.join(project, ".aidlc-version"), "2.8.1\n");
    await writeFile(marker, `${pinned}\n`);
    await writeFile(
      path.join(root, "pins.json"),
      JSON.stringify({ [realpathSync(project)]: "2.8.1" }),
    );
    expect(readNativeInstall()?.version).toBe("2.8.2");
    expect(readNativeInstall(project)?.version).toBe("2.8.1");
    if (process.platform !== "win32") {
      await chmod(pinned, 0o644);
      expect(readNativeInstall(project)).toBeNull();
      await chmod(pinned, 0o755);
      await chmod(active, 0o644);
      expect(readNativeInstall()).toBeNull();
      expect(readNativeInstall(project)).toBeNull();
      await chmod(active, 0o755);
      expect(readNativeInstall(project)?.version).toBe("2.8.1");
    }
    // The stable launcher needs the active binary even when a registered pin survives.
    await rm(active);
    expect(readNativeInstall()).toBeNull();
    expect(readNativeInstall(project)).toBeNull();
    await writeFile(active, "fixture", { mode: 0o755 });
    await rm(path.join(root, "active-executable"));
    expect(readNativeInstall(project)).toBeNull();
    await writeFile(path.join(root, "active-executable"), active);
    await writeFile(marker, active);
    expect(readNativeInstall(project)).toBeNull();
    await writeFile(marker, pinned);
    await writeFile(path.join(root, "pins.json"), "{}");
    expect(readNativeInstall(project)).toBeNull();
    await writeFile(
      path.join(root, "pins.json"),
      JSON.stringify({ [realpathSync(project)]: "2.8.1" }),
    );
    await rm(pinned);
    expect(readNativeInstall(project)).toBeNull();
    await writeFile(path.join(project, ".aidlc-version"), "../../evil");
    expect(readNativeInstall(project)).toBeNull();
  });

  it("applies the exact dry-run plan with literal paths and explicit MCP consent", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok);
    const root = "C:\\work\\project & spaces";
    await expect(configureNative(native, root, "cursor", vi.fn(), runner)).resolves.toMatchObject({
      doctorOk: true,
    });
    expect(runner.mock.calls[0]?.[1]).toEqual([
      "config",
      "--project-dir",
      root,
      "--harness",
      "cursor",
      "--mcp",
      "none",
      "--dry-run",
      "--json",
    ]);
    expect(runner.mock.calls[1]?.[1]).toEqual([
      "config",
      "--project-dir",
      root,
      "--harness",
      "cursor",
      "--mcp",
      "none",
      "--plan-token",
      "exact-plan",
      "--json",
    ]);
    expect(runner.mock.calls[2]?.[1]).toEqual(["doctor"]);
    expect(runner.mock.calls.flat(2)).not.toContain("--force");
  });
  it("refuses Codex configuration before planning when Git is not initialized", async () => {
    git.mockResolvedValue(false);
    const runner = vi.fn();
    await expect(configureNative(native, "/project", "codex", vi.fn(), runner)).rejects.toThrow(
      "git init",
    );
    expect(runner).not.toHaveBeenCalled();
  });

  it.each(["git", "preview", "apply"])("stops after cancellation during %s", async (phase) => {
    const controller = new AbortController();
    let finish: () => void = () => {};
    const delayed = new Promise<void>((resolve) => {
      finish = resolve;
    });
    if (phase === "git")
      git.mockImplementationOnce(async () => {
        await delayed;
        return true;
      });
    const runner = vi.fn<SetupRunner>(async (_command, args) => {
      if (
        (phase === "preview" && args.includes("--dry-run")) ||
        (phase === "apply" && args.includes("--plan-token"))
      )
        await delayed;
      return args.includes("--dry-run") ? plan : ok;
    });
    const action = configureNative(native, "/project", "codex", vi.fn(), runner, {
      signal: controller.signal,
    });
    const outcome = expect(action).rejects.toThrow("cancelled");
    if (phase !== "git")
      await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(phase === "preview" ? 1 : 2));
    controller.abort(new Error("cancelled"));
    finish();
    await outcome;
    expect(runner).toHaveBeenCalledTimes(phase === "git" ? 0 : phase === "preview" ? 1 : 2);
    for (const call of runner.mock.calls) expect(call[4]).toBe(controller.signal);
  });

  it("does not apply a plan when the folder becomes invalid without an abort event", async () => {
    let current = true;
    const runner = vi.fn(async () => {
      current = false;
      return plan;
    });
    await expect(
      configureNative(native, "/project", "cursor", vi.fn(), runner, {
        isCurrent: () => current,
      }),
    ).rejects.toThrow("中止");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("terminates a running process on cancellation before returning", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setup-cancel-"));
    roots.push(root);
    const marker = path.join(root, "ready");
    const controller = new AbortController();
    const action = runSetupProcess(
      process.execPath,
      [
        "-e",
        'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 30000);',
        marker,
      ],
      root,
      process.env,
      controller.signal,
    );
    try {
      await vi.waitFor(() => expect(existsSync(marker)).toBe(true), { timeout: 10000 });
      const pid = Number(readFileSync(marker, "utf8"));
      controller.abort();
      expect((await action).code).not.toBe(0);
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      controller.abort();
      await action;
    }
  }, 20000);

  it("reports a spawn failure and refuses an already cancelled process", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setup-missing-"));
    roots.push(root);
    expect((await runSetupProcess(path.join(root, "missing-executable"), [], root)).code).not.toBe(
      0,
    );
    await expect(
      runSetupProcess(
        process.execPath,
        [],
        root,
        process.env,
        AbortSignal.abort(new Error("cancelled")),
      ),
    ).rejects.toThrow("cancelled");
  });

  it.each([
    [{ code: 4, stdout: '{"message":"active workflow"}', stderr: "" }, "active workflow"],
    [ok, "設定計画"],
  ])("never applies an invalid or refused plan", async (preview, message) => {
    const runner = vi.fn().mockResolvedValue(preview);
    await expect(configureNative(native, "/project", "claude", vi.fn(), runner)).rejects.toThrow(
      message,
    );
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("stops at an apply conflict without running doctor", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce({ code: 4, stdout: '{"message":"conflict"}', stderr: "" });
    await expect(configureNative(native, "/project", "claude", vi.fn(), runner)).rejects.toThrow(
      "conflict",
    );
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("returns diagnostic follow-ups instead of calling a failed doctor successful", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ code: 1, stdout: "PATH needs configuration", stderr: "" });
    await expect(configureNative(native, "/project", "codex", vi.fn(), runner)).resolves.toEqual({
      doctorOk: false,
      details: "PATH needs configuration",
    });
  });

  const bytes = new TextEncoder().encode("official installer fixture");
  const filename = process.platform === "win32" ? "install.ps1" : "install.sh";
  const row = `${createHash("sha256").update(bytes).digest("hex")}  ${filename}\n`;
  it("rejects changed, missing, and ambiguous bootstrap checksums", () => {
    expect(() => verifyInstaller(bytes, row, filename)).not.toThrow();
    for (const checksums of ["", row + row, row.replace(/^./, "z")]) {
      expect(() => verifyInstaller(bytes, checksums, filename)).toThrow("チェックサム");
    }
    expect(() => verifyInstaller(new Uint8Array([1]), row, filename)).toThrow("チェックサム");
  });

  it("runs the pinned official bootstrap and removes its unique temporary directory", async () => {
    let temporary = "";
    const runner = vi.fn().mockImplementation(async (_cmd, args, cwd, env) => {
      temporary = cwd;
      expect(existsSync(path.join(cwd, filename))).toBe(true);
      if (process.platform === "win32") {
        expect(args.slice(0, 5)).toEqual([
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
        ]);
        expect(env.AIDLC_GUIDE_INSTALL_VERSION).toBe(SETUP_RELEASE);
        expect(Object.keys(env).some((key) => key.toLowerCase() === "psmodulepath")).toBe(false);
      } else expect(args).toContain(SETUP_RELEASE);
      return ok;
    });
    const fetcher = vi
      .fn()
      .mockImplementation(
        async (url: string) => new Response(url.endsWith("checksums.txt") ? row : bytes),
      );
    await installNative(vi.fn(), runner, fetcher as typeof fetch);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(existsSync(temporary)).toBe(false);
    expect(
      fetcher.mock.calls.every(([url]) =>
        url.includes("/awslabs/aidlc-workflows/releases/download/v2.8.1/"),
      ),
    ).toBe(true);
  });

  it("installs a requested native release instead of the setup default", async () => {
    const runner = vi.fn().mockResolvedValue(ok);
    const fetcher = vi
      .fn()
      .mockImplementation(
        async (url: string) => new Response(url.endsWith("checksums.txt") ? row : bytes),
      );
    await installNative(vi.fn(), runner, fetcher as typeof fetch, "2.9.0");
    expect(
      fetcher.mock.calls.every(([url]) =>
        url.includes("/awslabs/aidlc-workflows/releases/download/v2.9.0/"),
      ),
    ).toBe(true);
    if (process.platform === "win32") {
      expect(runner.mock.calls[0]?.[3]?.AIDLC_GUIDE_INSTALL_VERSION).toBe("2.9.0");
    } else expect(runner.mock.calls[0]?.[1]).toContain("2.9.0");
  });

  it("rejects a non-semver native release before download", async () => {
    const runner = vi.fn();
    const fetcher = vi.fn();
    await expect(installNative(vi.fn(), runner, fetcher, "../evil")).rejects.toThrow("解釈");
    expect(runner).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not run a bootstrap after an HTTP failure", async () => {
    const runner = vi.fn();
    await expect(
      installNative(vi.fn(), runner, vi.fn().mockResolvedValue(new Response("", { status: 503 }))),
    ).rejects.toThrow("HTTP 503");
    expect(runner).not.toHaveBeenCalled();
  });
});
