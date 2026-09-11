import { describe, expect, it, vi } from "vitest";
import { type NativeInstall, SETUP_RELEASE } from "../src/native-setup.ts";
import {
  applyNativeWorkflowsUpdate,
  nativeUpdateBlockReason,
  nativeUpdateRelease,
  needsNativeMachineInstall,
  omittedRequiredHarnesses,
  wouldDowngradeWorkspace,
} from "../src/workflows-native-update.ts";

const machine: NativeInstall = {
  executable: "/user/aidlc",
  version: SETUP_RELEASE,
  binDir: "/user/bin",
};

function configurePlan(
  apply?: (harness: string) => Promise<{ doctorOk: boolean; details: string }>,
) {
  return vi
    .fn()
    .mockImplementation(
      async (
        _install: NativeInstall,
        _root: string,
        harness: string,
        _log: (line: string) => void,
        _runner: unknown,
        options?: { previewOnly?: boolean; planToken?: string },
      ) => {
        if (options?.previewOnly) return { doctorOk: true, details: "ok", planToken: "tok" };
        if (apply) return apply(harness);
        return { doctorOk: true, details: "ok" };
      },
    );
}

function hooks(
  overrides: {
    readInstall?: (version: string) => NativeInstall | null;
    readActive?: () => NativeInstall | null;
    readProjectPin?: (root: string) => string | null;
    readProjectPinState?: (root: string) => { exists: boolean; version: string | null };
    readWorkspaceVersions?: (root: string) => (string | null)[];
    install?: ReturnType<typeof vi.fn>;
    use?: ReturnType<typeof vi.fn>;
    pin?: ReturnType<typeof vi.fn>;
    unpin?: ReturnType<typeof vi.fn>;
    configure?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    readInstall: () => machine,
    readActive: () => null,
    readProjectPin: () => null,
    readWorkspaceVersions: () => ["2.7.1"],
    install: vi.fn(),
    use: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
    configure: configurePlan(),
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

describe("wouldDowngradeWorkspace", () => {
  it("refuses when any installed version is newer than the bootstrap", () => {
    expect(wouldDowngradeWorkspace(["2.7.1"], SETUP_RELEASE)).toBe(false);
    expect(wouldDowngradeWorkspace(["2.7.1", "3.0.0"], SETUP_RELEASE)).toBe(true);
    expect(wouldDowngradeWorkspace(["2.8.1"], SETUP_RELEASE)).toBe(false);
    expect(wouldDowngradeWorkspace(["3.0.0"], SETUP_RELEASE)).toBe(true);
  });
});

describe("omittedRequiredHarnesses", () => {
  it("requires every detected harness except a Copilot/opencode collision pair", () => {
    expect(omittedRequiredHarnesses(["cursor", "claude"], ["cursor"])).toEqual(["claude"]);
    expect(omittedRequiredHarnesses(["cursor", "claude"], ["cursor", "claude"])).toEqual([]);
    expect(
      omittedRequiredHarnesses(["copilot", "opencode", "cursor"], ["copilot", "cursor"]),
    ).toEqual([]);
    expect(omittedRequiredHarnesses(["copilot", "opencode"], [])).toEqual(["copilot", "opencode"]);
  });
});

describe("applyNativeWorkflowsUpdate", () => {
  it("skips the installer when the target version is present and preserves MCP consent", async () => {
    const log = vi.fn();
    const install = vi.fn();
    const use = vi.fn();
    const pin = vi.fn();
    const configure = configurePlan();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log,
        hooks: hooks({ install, use, pin, configure }),
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).not.toHaveBeenCalled();
    expect(use).toHaveBeenCalledWith(machine, SETUP_RELEASE, log);
    expect(pin).toHaveBeenCalledWith(machine, "/project", SETUP_RELEASE, log);
    expect(configure.mock.calls.map((call) => call[5])).toEqual([
      { mcp: "preserve", previewOnly: true },
      { mcp: "preserve" },
    ]);
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
    const configure = configurePlan();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: hooks({
          readInstall: (version) => (version === SETUP_RELEASE ? installed : newer),
          install,
          use,
          pin,
          configure,
        }),
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
    const configure = configurePlan();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex", "cursor"],
        log: vi.fn(),
        hooks: hooks({ readInstall: () => installed, install, use, pin, configure }),
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(install).toHaveBeenCalledWith(expect.any(Function), undefined, fetch, SETUP_RELEASE);
    expect(configure.mock.calls.map((call) => [call[2], Boolean(call[5]?.previewOnly)])).toEqual([
      ["codex", true],
      ["cursor", true],
      ["codex", false],
      ["cursor", false],
    ]);
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

  it("refuses a subset of detected harnesses before touching the pin", async () => {
    const selectedHooks = hooks();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["cursor"],
        detected: ["cursor", "claude"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "incomplete-selection" });
    expect(selectedHooks.use).not.toHaveBeenCalled();
    expect(selectedHooks.pin).not.toHaveBeenCalled();
    expect(selectedHooks.configure).not.toHaveBeenCalled();
  });

  it("allows omitting one of Copilot or opencode when both are detected", async () => {
    const configure = configurePlan();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["copilot", "cursor"],
        detected: ["copilot", "opencode", "cursor"],
        log: vi.fn(),
        hooks: hooks({ configure }),
      }),
    ).resolves.toEqual({ ok: true, target: SETUP_RELEASE });
    expect(configure.mock.calls.map((call) => call[2])).toEqual([
      "copilot",
      "cursor",
      "copilot",
      "cursor",
    ]);
  });

  it("keeps going after one harness fails and reports the failed ids", async () => {
    const configure = configurePlan(async (harness) => {
      if (harness === "claude") throw new Error("conflict");
      return { doctorOk: false, details: "PATH" };
    });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["claude", "codex"],
        log: vi.fn(),
        hooks: hooks({ configure }),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "claude" });
    expect(configure).toHaveBeenCalledTimes(4);
  });

  it("preflights every harness before applying the first and restores the pin on conflict", async () => {
    const configure = vi.fn(
      async (
        _install: NativeInstall,
        _root: string,
        harness: string,
        _log: (line: string) => void,
        _runner: unknown,
        options?: { previewOnly?: boolean },
      ) => {
        if (options?.previewOnly) {
          if (harness === "codex") throw new Error("managed file conflict");
          return { doctorOk: true, details: "ok", planToken: "tok" };
        }
        return { doctorOk: true, details: "ok" };
      },
    );
    const selectedHooks = hooks({
      readProjectPin: () => "2.7.1",
      configure,
    });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["cursor", "codex"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "preflight" });
    expect(configure.mock.calls.map((call) => [call[2], Boolean(call[5]?.previewOnly)])).toEqual([
      ["cursor", true],
      ["codex", true],
    ]);
    expect(selectedHooks.pin).toHaveBeenLastCalledWith(
      machine,
      "/project",
      "2.7.1",
      expect.any(Function),
    );
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
    const use = vi.fn();
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: hooks({
          readActive: () => ({ ...machine, version: "3.0.0" }),
          use,
          pin: vi.fn().mockRejectedValue(new Error("workflow active")),
          configure,
        }),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "pin-failed" });
    expect(configure).not.toHaveBeenCalled();
    expect(use).toHaveBeenLastCalledWith(machine, "3.0.0", expect.any(Function));
  });

  it("restores the previous pin when every harness refresh fails", async () => {
    const unpin = vi.fn();
    const configure = vi.fn().mockRejectedValue(new Error("active workflow"));
    const selectedHooks = hooks({
      readActive: () => ({ ...machine, version: "3.0.0" }),
      readProjectPin: () => "2.7.1",
      unpin,
      configure,
    });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "preflight" });
    expect(selectedHooks.pin).toHaveBeenLastCalledWith(
      machine,
      "/project",
      "2.7.1",
      expect.any(Function),
    );
    expect(selectedHooks.use).toHaveBeenLastCalledWith(machine, "3.0.0", expect.any(Function));
    expect(unpin).not.toHaveBeenCalled();
  });

  it("refuses to pin when any installed harness is newer than the bootstrap", async () => {
    const selectedHooks = hooks({
      readWorkspaceVersions: () => ["2.7.1", "3.0.0"],
    });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex", "claude"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "would-downgrade" });
    expect(selectedHooks.use).not.toHaveBeenCalled();
    expect(selectedHooks.pin).not.toHaveBeenCalled();
    expect(selectedHooks.configure).not.toHaveBeenCalled();
  });

  it("refuses to overwrite a newer project pin even when projections are older", async () => {
    const selectedHooks = hooks({
      readProjectPin: () => "3.0.0",
      readWorkspaceVersions: () => ["2.7.1"],
    });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "would-downgrade" });
    expect(selectedHooks.use).not.toHaveBeenCalled();
    expect(selectedHooks.pin).not.toHaveBeenCalled();
    expect(selectedHooks.configure).not.toHaveBeenCalled();
  });

  it("refuses an unreadable project pin instead of unpinning it on rollback", async () => {
    const selectedHooks = hooks({
      readProjectPinState: () => ({ exists: true, version: null }),
    });
    await expect(
      applyNativeWorkflowsUpdate({
        workspaceRoot: "/project",
        pin: "2.8.0",
        selected: ["codex"],
        log: vi.fn(),
        hooks: selectedHooks,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "pin-unreadable" });
    expect(selectedHooks.install).not.toHaveBeenCalled();
    expect(selectedHooks.use).not.toHaveBeenCalled();
    expect(selectedHooks.pin).not.toHaveBeenCalled();
    expect(selectedHooks.unpin).not.toHaveBeenCalled();
    expect(selectedHooks.configure).not.toHaveBeenCalled();
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
