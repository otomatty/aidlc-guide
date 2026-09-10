import { describe, expect, it, vi } from "vitest";
import { type NativeInstall, SETUP_RELEASE } from "../src/native-setup.ts";
import {
  applyNativeWorkflowsUpdate,
  nativeUpdateBlockReason,
  nativeUpdateRelease,
  needsNativeMachineInstall,
} from "../src/workflows-native-update.ts";

const machine: NativeInstall = {
  executable: "/user/aidlc",
  version: SETUP_RELEASE,
  binDir: "/user/bin",
};

function hooks(
  overrides: {
    readInstall?: (version: string) => NativeInstall | null;
    install?: ReturnType<typeof vi.fn>;
    use?: ReturnType<typeof vi.fn>;
    pin?: ReturnType<typeof vi.fn>;
    configure?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    readInstall: () => machine,
    install: vi.fn(),
    use: vi.fn(),
    pin: vi.fn(),
    configure: vi.fn().mockResolvedValue({ doctorOk: true, details: "ok" }),
    ...overrides,
  };
}

describe("nativeUpdateRelease", () => {
  it("installs the published setup bootstrap instead of treating a docs pin as a tag", () => {
    expect(nativeUpdateRelease("2.8.0")).toBe(SETUP_RELEASE);
    expect(nativeUpdateRelease("2.8.1")).toBe(SETUP_RELEASE);
    expect(nativeUpdateRelease("2.9.0")).toBeNull();
    expect(nativeUpdateRelease("3.0.0")).toBeNull();
    expect(nativeUpdateRelease("2.9.0-rc.1")).toBeNull();
    expect(nativeUpdateRelease("unknown")).toBeNull();
  });

  it("distinguishes a pin newer than the bootstrap from an unreadable pin", () => {
    expect(nativeUpdateBlockReason("2.8.0")).toBeNull();
    expect(nativeUpdateBlockReason("2.9.0")).toBe("pin-ahead");
    expect(nativeUpdateBlockReason("3.0.0")).toBe("pin-ahead");
    expect(nativeUpdateBlockReason("2.9.0-rc.1")).toBe("pin-invalid");
    expect(nativeUpdateBlockReason("2.7.0-beta.1")).toBe("pin-invalid");
    expect(nativeUpdateBlockReason("unknown")).toBe("pin-invalid");
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
    const use = vi.fn();
    const pin = vi.fn();
    const configure = vi.fn().mockResolvedValue({ doctorOk: true, details: "ok" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log,
        hooks: { readInstall: () => machine, install, use, pin, configure },
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).not.toHaveBeenCalled();
    expect(use).toHaveBeenCalledWith(machine, SETUP_RELEASE, log);
    expect(pin).toHaveBeenCalledWith(machine, "/project", SETUP_RELEASE, log);
    expect(configure).toHaveBeenCalledWith(machine, "/project", "codex", log, undefined, {
      mcp: "preserve",
    });
    const used = use.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const pinned = pin.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const configured = configure.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    expect(used).toBeLessThan(pinned);
    expect(pinned).toBeLessThan(configured);
  });

  it("does not configure with a newer active runtime when the target version is missing", async () => {
    let installed: NativeInstall | null = null;
    const newer = { ...machine, version: "3.0.0" };
    const install = vi.fn(async () => {
      installed = machine;
    });
    const use = vi.fn();
    const pin = vi.fn();
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
          use,
          pin,
          configure,
        },
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).toHaveBeenCalledWith(expect.any(Function), undefined, fetch, SETUP_RELEASE);
    expect(use).toHaveBeenCalledWith(machine, SETUP_RELEASE, expect.any(Function));
    expect(pin).toHaveBeenCalledWith(machine, "/project", SETUP_RELEASE, expect.any(Function));
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
    const use = vi.fn();
    const pin = vi.fn();
    const configure = vi.fn().mockResolvedValue({ doctorOk: true, details: "ok" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex", "cursor"],
        log: vi.fn(),
        hooks: { readInstall: () => installed, install, use, pin, configure },
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).toHaveBeenCalledWith(expect.any(Function), undefined, fetch, SETUP_RELEASE);
    expect(configure.mock.calls.map((call) => call[2])).toEqual(["codex", "cursor"]);
  });

  it("refuses an empty selection and a Copilot/opencode collision", async () => {
    const install = vi.fn();
    const use = vi.fn();
    const pin = vi.fn();
    const configure = vi.fn();
    const selectedHooks = hooks({ install, use, pin, configure });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: [],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "empty-selection" });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["copilot", "opencode"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "collision" });
    expect(install).not.toHaveBeenCalled();
    expect(use).not.toHaveBeenCalled();
    expect(pin).not.toHaveBeenCalled();
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
        hooks: hooks({ configure }),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "claude" });
    expect(configure).toHaveBeenCalledTimes(2);
  });

  it("reports an installer failure without configuring the project", async () => {
    const use = vi.fn();
    const pin = vi.fn();
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
          use,
          pin,
          configure,
        },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "install-failed" });
    expect(use).not.toHaveBeenCalled();
    expect(pin).not.toHaveBeenCalled();
    expect(configure).not.toHaveBeenCalled();
  });

  it("fails when the installer finishes but the binary is still missing", async () => {
    const use = vi.fn();
    const pin = vi.fn();
    const configure = vi.fn();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: {
          readInstall: () => null,
          install: vi.fn().mockResolvedValue(undefined),
          use,
          pin,
          configure,
        },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "missing-binary" });
    expect(use).not.toHaveBeenCalled();
    expect(pin).not.toHaveBeenCalled();
    expect(configure).not.toHaveBeenCalled();
  });

  it("stops before pin or configure when switching the active runtime fails", async () => {
    const pin = vi.fn();
    const configure = vi.fn();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: hooks({
          use: vi.fn().mockRejectedValue(new Error("already in use")),
          pin,
          configure,
        }),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "use-failed" });
    expect(pin).not.toHaveBeenCalled();
    expect(configure).not.toHaveBeenCalled();
  });

  it("stops before configure when writing the project pin fails", async () => {
    const configure = vi.fn();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: hooks({
          pin: vi.fn().mockRejectedValue(new Error("workflow active")),
          configure,
        }),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "pin-failed" });
    expect(configure).not.toHaveBeenCalled();
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

  it("refuses a pin newer than the bootstrap runtime", async () => {
    const selectedHooks = hooks();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.9.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "pin-ahead", target: "2.9.0" });
    expect(selectedHooks.install).not.toHaveBeenCalled();
    expect(selectedHooks.use).not.toHaveBeenCalled();
    expect(selectedHooks.pin).not.toHaveBeenCalled();
    expect(selectedHooks.configure).not.toHaveBeenCalled();
  });
});
