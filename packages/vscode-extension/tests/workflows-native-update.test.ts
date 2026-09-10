import { describe, expect, it, vi } from "vitest";
import { type NativeInstall, SETUP_RELEASE } from "../src/native-setup.ts";
import {
  applyNativeWorkflowsUpdate,
  nativeUpdateRelease,
  needsNativeMachineInstall,
} from "../src/workflows-native-update.ts";

const machine: NativeInstall = {
  executable: "/user/aidlc",
  version: SETUP_RELEASE,
  binDir: "/user/bin",
};

describe("nativeUpdateRelease", () => {
  it("installs the published setup bootstrap instead of treating a docs pin as a tag", () => {
    expect(nativeUpdateRelease("2.8.0")).toBe(SETUP_RELEASE);
    expect(nativeUpdateRelease("2.8.1")).toBe(SETUP_RELEASE);
    expect(nativeUpdateRelease("2.9.0")).toBe(SETUP_RELEASE);
    expect(nativeUpdateRelease("2.9.0-rc.1")).toBeNull();
    expect(nativeUpdateRelease("unknown")).toBeNull();
  });
});

describe("needsNativeMachineInstall", () => {
  it("installs unless the requested version is already present", () => {
    expect(needsNativeMachineInstall(null, "2.8.1")).toBe(true);
    expect(needsNativeMachineInstall({ ...machine, version: "2.8.0" }, "2.8.1")).toBe(true);
    expect(needsNativeMachineInstall({ ...machine, version: "3.0.0" }, "2.8.1")).toBe(true);
    expect(needsNativeMachineInstall(machine, "2.8.1")).toBe(false);
  });
});

describe("applyNativeWorkflowsUpdate", () => {
  it("skips the installer when the target version is present and preserves MCP consent", async () => {
    const log = vi.fn();
    const install = vi.fn();
    const configure = vi.fn().mockResolvedValue({ doctorOk: true, details: "ok" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log,
        hooks: { readInstall: () => machine, install, configure },
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).not.toHaveBeenCalled();
    expect(configure).toHaveBeenCalledWith(machine, "/project", "codex", log, undefined, {
      mcp: "preserve",
    });
  });

  it("does not configure with a newer active runtime when the target version is missing", async () => {
    let installed: NativeInstall | null = null;
    const newer = { ...machine, version: "3.0.0" };
    const install = vi.fn(async () => {
      installed = machine;
    });
    const configure = vi.fn().mockResolvedValue({ doctorOk: true, details: "ok" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: {
          readInstall: (version) => (version === SETUP_RELEASE ? installed : newer),
          install,
          configure,
        },
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).toHaveBeenCalledWith(expect.any(Function), undefined, fetch, SETUP_RELEASE);
    expect(configure).toHaveBeenCalledWith(
      machine,
      "/project",
      "codex",
      expect.any(Function),
      undefined,
      {
        mcp: "preserve",
      },
    );
  });

  it("installs the native runtime then configures each selected harness", async () => {
    let installed: NativeInstall | null = null;
    const install = vi.fn(async () => {
      installed = machine;
    });
    const configure = vi.fn().mockResolvedValue({ doctorOk: true, details: "ok" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex", "cursor"],
        log: vi.fn(),
        hooks: { readInstall: () => installed, install, configure },
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).toHaveBeenCalledWith(expect.any(Function), undefined, fetch, SETUP_RELEASE);
    expect(configure.mock.calls.map((call) => call[2])).toEqual(["codex", "cursor"]);
  });

  it("refuses an empty selection and a Copilot/opencode collision", async () => {
    const install = vi.fn();
    const configure = vi.fn();
    const hooks = { readInstall: () => machine, install, configure };
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: [],
        log: vi.fn(),
        hooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "empty-selection" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["copilot", "opencode"],
        log: vi.fn(),
        hooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "collision" });
    expect(install).not.toHaveBeenCalled();
    expect(configure).not.toHaveBeenCalled();
  });

  it("keeps going after one harness fails and reports the failed ids", async () => {
    const configure = vi
      .fn()
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce({ doctorOk: false, details: "PATH" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["claude", "codex"],
        log: vi.fn(),
        hooks: { readInstall: () => machine, install: vi.fn(), configure },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "claude" });
    expect(configure).toHaveBeenCalledTimes(2);
  });

  it("reports an installer failure without configuring the project", async () => {
    const configure = vi.fn();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: {
          readInstall: () => null,
          install: vi.fn().mockRejectedValue(new Error("HTTP 503")),
          configure,
        },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "install-failed" });
    expect(configure).not.toHaveBeenCalled();
  });

  it("fails when the installer finishes but the binary is still missing", async () => {
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: {
          readInstall: () => null,
          install: vi.fn().mockResolvedValue(undefined),
          configure: vi.fn(),
        },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "missing-binary" });
  });

  it("refuses an unreadable pin", async () => {
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "unknown",
        selected: ["codex"],
        log: vi.fn(),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "pin-invalid" });
  });
});
