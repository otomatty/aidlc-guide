import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
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
  inspectProjectPin,
  installLocations,
  installNative,
  pinNative,
  quarantineRetainedVersion,
  readNativeInstall,
  readProjectPin,
  readVersionedNativeInstall,
  runNativeDoctor,
  runSetupProcess,
  SETUP_RELEASE,
  type SetupRunner,
  unpinNative,
  useNative,
  verifyInstaller,
} from "../src/native-setup.ts";

const ok = { code: 0, stdout: JSON.stringify({ ok: true, message: "configured" }), stderr: "" };
const plan = { ...ok, stdout: JSON.stringify({ ok: true, data: { planToken: "exact-plan" } }) };
const native = { executable: "/user/aidlc", version: "2.8.1", binDir: "/user/bin" };
const doctorResult = {
  code: 0,
  stdout:
    "AI-DLC doctor\n\nMachine\n\nProject (.cursor, Cursor)\n  ok    Runtime locks: none leaked\n\nFramework integrity\n\n0 problems, 0 warnings.\nYour install is ready.\n",
  stderr: "",
};
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

  it("resolves a requested version directory even when a different version is active", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-version-"));
    roots.push(root);
    vi.stubEnv("AIDLC_INSTALL_ROOT", root);
    const executableName = process.platform === "win32" ? "aidlc.exe" : "aidlc";
    const target = path.join(root, "versions", "2.8.1", executableName);
    const active = path.join(root, "versions", "3.0.0", executableName);
    for (const exe of [target, active]) {
      await mkdir(path.dirname(exe), { recursive: true });
      await writeFile(exe, "fixture", { mode: 0o755 });
    }
    await writeFile(
      path.join(root, "versions", "2.8.1", "version.json"),
      JSON.stringify({
        schemaVersion: 1,
        version: "2.8.1",
        assets: [{ sha256: createHash("sha256").update("fixture").digest("hex") }],
      }),
    );
    await mkdir(path.join(root, "versions", "2.8.1", "runtime"));
    await writeFile(path.join(root, "active-executable"), `${active}\n`);
    expect(readNativeInstall()?.version).toBe("3.0.0");
    expect(readVersionedNativeInstall("2.8.1")?.version).toBe("2.8.1");
    expect(readVersionedNativeInstall("2.8.0")).toBeNull();
  });

  it("does not treat an incomplete retained version as installed", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-incomplete-"));
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
    expect(readVersionedNativeInstall("2.8.1")).toBeNull();
  });

  it("does not treat a retained version with empty assets as installed", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-empty-assets-"));
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
    await writeFile(
      path.join(root, "versions", "2.8.1", "version.json"),
      JSON.stringify({ schemaVersion: 1, version: "2.8.1", assets: [] }),
    );
    await mkdir(path.join(root, "versions", "2.8.1", "runtime"));
    expect(readVersionedNativeInstall("2.8.1")).toBeNull();
  });

  it("quarantines an incomplete retained version and leaves a complete one in place", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-quarantine-"));
    roots.push(root);
    vi.stubEnv("AIDLC_INSTALL_ROOT", root);
    const incomplete = path.join(
      root,
      "versions",
      "2.8.1",
      process.platform === "win32" ? "aidlc.exe" : "aidlc",
    );
    await mkdir(path.dirname(incomplete), { recursive: true });
    await writeFile(incomplete, "broken", { mode: 0o755 });
    const log = vi.fn();
    expect(quarantineRetainedVersion("2.8.1", log)).toBe(true);
    expect(existsSync(path.dirname(incomplete))).toBe(false);
    const recovered = readdirSync(root).filter((entry) => entry.startsWith(".aidlc-recovery-"));
    expect(recovered).toHaveLength(1);
    expect(existsSync(path.join(root, recovered[0] ?? "", path.basename(incomplete)))).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("隔離"));

    const complete = path.join(
      root,
      "versions",
      "2.8.1",
      process.platform === "win32" ? "aidlc.exe" : "aidlc",
    );
    await mkdir(path.dirname(complete), { recursive: true });
    await writeFile(complete, "fixture", { mode: 0o755 });
    await writeFile(
      path.join(root, "versions", "2.8.1", "version.json"),
      JSON.stringify({
        schemaVersion: 1,
        version: "2.8.1",
        assets: [{ sha256: createHash("sha256").update("fixture").digest("hex") }],
      }),
    );
    await mkdir(path.join(root, "versions", "2.8.1", "runtime"));
    expect(quarantineRetainedVersion("2.8.1", vi.fn())).toBe(false);
    expect(existsSync(complete)).toBe(true);
    expect(quarantineRetainedVersion("2.8.1", vi.fn(), { force: true })).toBe(true);
    expect(existsSync(path.dirname(complete))).toBe(false);
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
      .mockResolvedValueOnce(doctorResult);
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
    expect(runner.mock.calls[2]?.[1]).toEqual([
      "doctor",
      "--project-dir",
      root,
      "--verbose",
      "--no-color",
    ]);
    expect(runner.mock.calls.flat(2)).not.toContain("--force");
  });

  it("switches the machine-active runtime without rewriting project files", async () => {
    const runner = vi.fn().mockResolvedValue(ok);
    await useNative(native, "2.8.1", vi.fn(), runner);
    expect(runner.mock.calls[0]?.[1]).toEqual(["use", "2.8.1"]);
    expect(runner.mock.calls.flat(2)).not.toContain("--project-dir");
  });

  it("writes the project pin before a harness refresh", async () => {
    const runner = vi.fn().mockResolvedValue(ok);
    await pinNative(native, "/project", "2.8.1", vi.fn(), runner);
    expect(runner.mock.calls[0]?.[1]).toEqual([
      "config",
      "--pin",
      "2.8.1",
      "--project-dir",
      "/project",
    ]);
  });

  it("refuses an unreadable version before use or pin", async () => {
    const runner = vi.fn();
    await expect(useNative(native, "../evil", vi.fn(), runner)).rejects.toThrow("解釈");
    await expect(pinNative(native, "/project", "2.9.0-rc.1", vi.fn(), runner)).rejects.toThrow(
      "解釈",
    );
    expect(runner).not.toHaveBeenCalled();
  });

  it("reads a strict project pin and unpins without a harness refresh", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-pin-"));
    roots.push(root);
    expect(inspectProjectPin(root)).toEqual({ exists: false, version: null });
    expect(readProjectPin(root)).toBeNull();
    await writeFile(path.join(root, ".aidlc-version"), "not-a-version\n");
    expect(inspectProjectPin(root)).toEqual({ exists: true, version: null });
    expect(readProjectPin(root)).toBeNull();
    await writeFile(path.join(root, ".aidlc-version"), "2.7.1\n");
    expect(inspectProjectPin(root)).toEqual({ exists: true, version: "2.7.1" });
    expect(readProjectPin(root)).toBe("2.7.1");
    const runner = vi.fn().mockResolvedValue(ok);
    await unpinNative(native, root, vi.fn(), runner);
    expect(runner.mock.calls[0]?.[1]).toEqual(["config", "--unpin", "--project-dir", root]);
  });

  it("returns a plan token without applying when previewing", async () => {
    const runner = vi.fn().mockResolvedValue(plan);
    const result = await configureNative(native, "/project", "claude", vi.fn(), runner, {
      mcp: "preserve",
      previewOnly: true,
    });
    expect(result).toMatchObject({ planToken: "exact-plan", doctorOk: true });
    expect(result.doctorReport).toBeUndefined();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls.flat(2)).not.toContain("--plan-token");
  });

  it("uses the same explicit runtime source for preview and apply", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok);
    const sourceRoot = path.join("/retained", "2.8.0", "runtime", "cursor");
    await configureNative(native, "/candidate", "cursor", vi.fn(), runner, { sourceRoot });
    for (const call of runner.mock.calls.slice(0, 2)) {
      const args = call[1] as string[];
      expect(args[args.indexOf("--from") + 1]).toBe(sourceRoot);
    }
    expect(runner.mock.calls[2]?.[1]).not.toContain("--from");
  });

  it("notifies apply start only after preview succeeds", async () => {
    const onApplyStart = vi.fn();
    const runner = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok);
    await configureNative(native, "/project", "claude", vi.fn(), runner, {
      mcp: "preserve",
      onApplyStart,
    });
    expect(onApplyStart).toHaveBeenCalledTimes(1);
    expect(runner.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      onApplyStart.mock.invocationCallOrder[0] ?? 0,
    );
    expect(onApplyStart.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      runner.mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("does not notify apply start for a preview-only configure", async () => {
    const onApplyStart = vi.fn();
    const runner = vi.fn().mockResolvedValue(plan);
    await configureNative(native, "/project", "claude", vi.fn(), runner, {
      previewOnly: true,
      onApplyStart,
    });
    expect(onApplyStart).not.toHaveBeenCalled();
  });

  it("applies a previously issued plan token without dry-run", async () => {
    const runner = vi.fn().mockResolvedValueOnce(ok).mockResolvedValueOnce(doctorResult);
    const result = await configureNative(native, "/project", "claude", vi.fn(), runner, {
      mcp: "preserve",
      planToken: "exact-plan",
    });
    expect(result).toMatchObject({
      planToken: "exact-plan",
      doctorOk: true,
      doctorReport: { outcome: "ok" },
    });
    expect(runner.mock.calls.map((call) => call[1]?.[0])).toEqual(["config", "doctor"]);
    expect(runner.mock.calls[0]?.[1]).toEqual([
      "config",
      "--project-dir",
      "/project",
      "--harness",
      "claude",
      "--plan-token",
      "exact-plan",
      "--json",
    ]);
    expect(runner.mock.calls.flat(2)).not.toContain("--dry-run");
  });

  it("surfaces a failed use or pin without continuing", async () => {
    const failed = { code: 1, stdout: "", stderr: "busy" };
    await expect(
      useNative(native, "2.8.1", vi.fn(), vi.fn().mockResolvedValue(failed)),
    ).rejects.toThrow("busy");
    await expect(
      pinNative(native, "/project", "2.8.1", vi.fn(), vi.fn().mockResolvedValue(failed)),
    ).rejects.toThrow("busy");
  });

  it("omits MCP flags when a refresh should preserve recorded consent", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok);
    await configureNative(native, "/project", "claude", vi.fn(), runner, { mcp: "preserve" });
    expect(runner.mock.calls[0]?.[1]).toEqual([
      "config",
      "--project-dir",
      "/project",
      "--harness",
      "claude",
      "--dry-run",
      "--json",
    ]);
    expect(runner.mock.calls.flat(2)).not.toContain("--mcp");
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
    await expect(
      configureNative(native, "/project", "codex", vi.fn(), runner),
    ).resolves.toMatchObject({
      doctorOk: false,
      details: "PATH needs configuration",
      planToken: "exact-plan",
      doctorReport: { outcome: "unavailable" },
    });
  });

  it("runs doctor once with the verified executable, literal root, color disabled and a deadline", async () => {
    const runner = vi.fn().mockResolvedValue(doctorResult);
    const signal = new AbortController().signal;
    const root = "C:\\作業\\project & spaces";
    const report = await runNativeDoctor(native, root, runner, { signal });
    expect(report.outcome).toMatch(/ok|warning/);
    expect(report.counts).toEqual({ passed: 1, warnings: 0, failed: 0 });
    expect(runner).toHaveBeenCalledExactlyOnceWith(
      native.executable,
      ["doctor", "--project-dir", root, "--verbose", "--no-color"],
      root,
      expect.objectContaining({ NO_COLOR: "1" }),
      signal,
      { timeoutMs: 120_000 },
    );
    const env = runner.mock.calls[0]?.[3] as NodeJS.ProcessEnv;
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
    expect(env[pathKey]).toContain(`${native.binDir}${path.delimiter}`);
  });

  it("keeps a completed failed diagnosis separate from a process failure", async () => {
    const stdout = doctorResult.stdout
      .replace(
        "ok    Runtime locks: none leaked",
        "fail  Unknown failed check\n        fix: inspect the issue",
      )
      .replace("0 problems", "1 problem")
      .replace("Your install is ready.\n", "");
    const runner = vi.fn().mockResolvedValue({ code: 1, stdout, stderr: "" });
    const report = await runNativeDoctor(native, "/project", runner);
    expect(report.outcome).toBe("failed");
    expect(report.checks[0]?.status).toBe("fail");
    expect(report.rawOutput).toBe(stdout);
  });

  it("turns a runner exception into a Japanese unavailable report with the original error", async () => {
    const runner = vi.fn().mockRejectedValue(new Error("spawn ENOENT"));
    const report = await runNativeDoctor(native, "/project", runner);
    expect(report.outcome).toBe("unavailable");
    expect(report.summary).toMatch(/起動|実行/);
    expect(report.rawOutput).toContain("spawn ENOENT");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("does not publish a diagnosis after cancellation or folder invalidation", async () => {
    const controller = new AbortController();
    const runner = vi.fn().mockImplementation(async () => {
      controller.abort(new Error("cancelled"));
      return doctorResult;
    });
    await expect(
      runNativeDoctor(native, "/project", runner, { signal: controller.signal }),
    ).rejects.toThrow("cancelled");
    const unavailable = vi.fn();
    await expect(
      runNativeDoctor(native, "/project", unavailable, { isCurrent: () => false }),
    ).rejects.toThrow("中止");
    expect(unavailable).not.toHaveBeenCalled();
  });

  it.each(["preview", "apply"])(
    "surfaces a silent nonzero process exit during config %s",
    async (stage) => {
      const root = await mkdtemp(path.join(tmpdir(), "setup-silent-exit-"));
      roots.push(root);
      const silent = await runSetupProcess(process.execPath, ["-e", "process.exit(7)"], root);
      expect(silent.code).toBe(7);
      expect(silent.stdout).toBe("");
      expect(silent.stderr).toContain("process.exit(7)");
      expect(silent.failure).toBeUndefined();
      const runner = vi.fn<SetupRunner>();
      if (stage === "apply") runner.mockResolvedValueOnce(plan);
      runner.mockResolvedValueOnce(silent);
      await expect(configureNative(native, root, "claude", vi.fn(), runner)).rejects.toThrow(
        silent.stderr,
      );
      expect(runner).toHaveBeenCalledTimes(stage === "preview" ? 1 : 2);
    },
  );

  it("classifies a real timeout and leaves ordinary nonzero stdout/stderr intact", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "doctor-process-"));
    roots.push(root);
    const timeout = await runSetupProcess(
      process.execPath,
      ["-e", "setInterval(() => {}, 10000)"],
      root,
      process.env,
      undefined,
      { timeoutMs: 100 },
    );
    expect(timeout.failure).toBe("timeout");
    const failed = await runSetupProcess(
      process.execPath,
      ["-e", "process.stdout.write('diagnosis');process.exitCode=1"],
      root,
    );
    expect(failed).toEqual({ code: 1, stdout: "diagnosis", stderr: "" });
    const stderrOnly = await runSetupProcess(
      process.execPath,
      ["-e", "process.stderr.write('diagnostic error');process.exitCode=1"],
      root,
    );
    expect(stderrOnly).toEqual({ code: 1, stdout: "", stderr: "diagnostic error" });
    const missing = await runSetupProcess(path.join(root, "missing"), [], root);
    expect(missing.failure).toBe("spawn");
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

  it("quarantines an incomplete retained destination before running the installer", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "native-install-repair-"));
    roots.push(root);
    vi.stubEnv("AIDLC_INSTALL_ROOT", root);
    const dest = path.join(
      root,
      "versions",
      SETUP_RELEASE,
      process.platform === "win32" ? "aidlc.exe" : "aidlc",
    );
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, "broken", { mode: 0o755 });
    const runner = vi.fn().mockResolvedValue(ok);
    const fetcher = vi
      .fn()
      .mockImplementation(
        async (url: string) => new Response(url.endsWith("checksums.txt") ? row : bytes),
      );
    await installNative(vi.fn(), runner, fetcher as typeof fetch);
    expect(existsSync(path.dirname(dest))).toBe(false);
    expect(readdirSync(root).some((entry) => entry.startsWith(".aidlc-recovery-"))).toBe(true);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("cancels bootstrap downloads before running the installer", async () => {
    const controller = new AbortController();
    const runner = vi.fn();
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      controller.abort(new Error("installation cancelled"));
      return new Response(url.endsWith("checksums.txt") ? row : bytes);
    });
    await expect(
      installNative(vi.fn(), runner, fetcher as typeof fetch, SETUP_RELEASE, {
        signal: controller.signal,
      }),
    ).rejects.toThrow("installation cancelled");
    expect(runner).not.toHaveBeenCalled();
    for (const [, options] of fetcher.mock.calls) expect(options?.signal?.aborted).toBe(true);
  });

  it("passes cancellation to bootstrap execution and still cleans its temporary directory", async () => {
    const controller = new AbortController();
    let temporary = "";
    const runner = vi.fn<SetupRunner>(async (_cmd, _args, cwd, _env, signal) => {
      temporary = cwd;
      expect(signal).toBe(controller.signal);
      controller.abort(new Error("installation cancelled"));
      return ok;
    });
    const fetcher = vi.fn(
      async (url: string) => new Response(url.endsWith("checksums.txt") ? row : bytes),
    );
    await expect(
      installNative(vi.fn(), runner, fetcher as typeof fetch, SETUP_RELEASE, {
        signal: controller.signal,
      }),
    ).rejects.toThrow("installation cancelled");
    expect(existsSync(temporary)).toBe(false);
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
