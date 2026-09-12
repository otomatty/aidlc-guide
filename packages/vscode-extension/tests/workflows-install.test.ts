import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HarnessId } from "../src/harness-detect.ts";
import {
  configureNative,
  type NativeInstall,
  SETUP_RELEASE,
  type SetupRunner,
} from "../src/native-setup.ts";
import {
  installWorkflows,
  type WorkflowsInstallHooks,
  type WorkflowsInstallOptions,
} from "../src/workflows-install.ts";

const machine: NativeInstall = {
  executable: "/user/aidlc",
  version: SETUP_RELEASE,
  binDir: "/user/bin",
};

function fixture(overrides: WorkflowsInstallHooks = {}) {
  const hooks = {
    detect: () => [],
    readWorkspaceVersions: () => [],
    inspectPin: () => ({ exists: false, version: null }),
    readActive: () => machine,
    readInstall: () => machine,
    isGitRepository: vi.fn(async () => true),
    install: vi.fn(async () => {}),
    configure: vi.fn(async () => ({ doctorOk: true, details: "診断済み" })),
    ...overrides,
  } satisfies WorkflowsInstallHooks;
  const options: WorkflowsInstallOptions = {
    workspaceRoot: "/project",
    selected: ["claude"],
    log: vi.fn(),
    onHarnessResult: vi.fn(),
    hooks,
  };
  return { hooks, options };
}

function expectNoWrites(hooks: WorkflowsInstallHooks) {
  expect(hooks.install).not.toHaveBeenCalled();
  expect(hooks.configure).not.toHaveBeenCalled();
}

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("installWorkflows", () => {
  it("installs the runtime once and configures multiple selected harnesses in order", async () => {
    let installed = false;
    const progress: string[] = [];
    const install = vi.fn(async () => {
      installed = true;
    });
    const { hooks, options } = fixture({
      readInstall: () => (installed ? machine : null),
      readActive: () => (installed ? machine : null),
      install,
      configure: vi.fn<typeof configureNative>(async (_runtime, _root, id) => {
        expect(installed).toBe(true);
        progress.push(`${id}:start`);
        await Promise.resolve();
        progress.push(`${id}:done`);
        return { doctorOk: true, details: "診断済み" };
      }),
    });
    options.selected = ["claude", "cursor", "codex"];
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ ok: true, target: SETUP_RELEASE });
    expect(install).toHaveBeenCalledExactlyOnceWith(
      options.log,
      undefined,
      fetch,
      SETUP_RELEASE,
      {},
    );
    expect(vi.mocked(hooks.configure).mock.calls.map((call) => call[2])).toEqual(options.selected);
    expect(progress).toEqual([
      "claude:start",
      "claude:done",
      "cursor:start",
      "cursor:done",
      "codex:start",
      "codex:done",
    ]);
    expect(result.harnesses.map((item) => item.status)).toEqual([
      "configured",
      "configured",
      "configured",
    ]);
    expect(options.onHarnessResult).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(hooks.configure).mock.calls) {
      expect(call[5]).toEqual({ mcp: "preserve" });
    }
  });

  it("skips installed tools and adds missing tools using the matching runtime", async () => {
    const { hooks, options } = fixture({
      detect: () => ["claude"],
      readWorkspaceVersions: () => [SETUP_RELEASE],
    });
    options.selected = ["cursor", "claude", "codex"];
    expect(await installWorkflows(options)).toMatchObject({
      ok: true,
      target: SETUP_RELEASE,
      harnesses: [
        { id: "claude", status: "skipped" },
        { id: "cursor", status: "configured" },
        { id: "codex", status: "configured" },
      ],
    });
    expect(hooks.install).not.toHaveBeenCalled();
    expect(vi.mocked(hooks.configure).mock.calls.map((call) => call[2])).toEqual([
      "cursor",
      "codex",
    ]);
  });

  it("does not reconfigure a selection that is already present", async () => {
    const { hooks, options } = fixture({
      detect: () => ["claude", "cursor"],
      readWorkspaceVersions: () => [SETUP_RELEASE, SETUP_RELEASE],
    });
    expect((await installWorkflows(options)).ok).toBe(true);
    expectNoWrites(hooks);
  });

  it("reports a single harness failure", async () => {
    const configure = vi.fn<typeof configureNative>(async (_runtime, _root, id) => {
      if (id === "claude") throw new Error("保存できません");
      return { doctorOk: true, details: "正常" };
    });
    const { options } = fixture({ configure });
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ ok: false, reason: "configure-failed" });
    expect(result.harnesses).toEqual([
      { id: "claude", status: "failed", message: expect.stringContaining("保存できません") },
    ]);
    expect(configure).toHaveBeenCalledTimes(1);
  });

  it.each(["2.8.0", "2.8.1"])(
    "configures multiple tools with the registered project runtime %s",
    async (version) => {
      const runtime = { ...machine, version };
      const { hooks, options } = fixture({
        inspectPin: () => ({ exists: true, version }),
        readActive: (root) => (root ? runtime : machine),
        readInstall: () => runtime,
      });
      options.selected = ["claude", "cursor"];
      expect(await installWorkflows(options)).toMatchObject({
        ok: true,
        target: version,
        harnesses: [
          { id: "claude", status: "configured" },
          { id: "cursor", status: "configured" },
        ],
      });
      expect(hooks.install).not.toHaveBeenCalled();
      expect(vi.mocked(hooks.configure).mock.calls.map((call) => call[0])).toEqual([
        runtime,
        runtime,
      ]);
    },
  );

  it.each(["failed only", "original selection"])(
    "continues after a tool fails and retries only missing tools with %s",
    async (retry) => {
      const installed = new Set<HarnessId>();
      let failCursor = true;
      const configure = vi.fn<typeof configureNative>(async (_runtime, _root, id) => {
        if (id === "cursor" && failCursor) throw new Error("Cursor の設定が競合しています");
        installed.add(id);
        return { doctorOk: true, details: "正常" };
      });
      const { hooks, options } = fixture({
        detect: () => [...installed],
        readWorkspaceVersions: () => [...installed].map(() => SETUP_RELEASE),
        configure,
      });
      options.selected = ["claude", "cursor", "codex"];
      const partial = await installWorkflows(options);
      expect(partial).toMatchObject({ ok: false, reason: "configure-failed" });
      expect(partial.harnesses).toMatchObject([
        { id: "claude", status: "configured" },
        { id: "cursor", status: "failed", message: expect.stringContaining("競合") },
        { id: "codex", status: "configured" },
      ]);
      expect(configure.mock.calls.map((call) => call[2])).toEqual(["claude", "cursor", "codex"]);
      expect([...installed]).toEqual(["claude", "codex"]);
      expect(options.onHarnessResult).toHaveBeenCalledTimes(3);
      failCursor = false;
      configure.mockClear();
      if (retry === "failed only")
        options.selected = partial.harnesses
          .filter((item) => item.status === "failed")
          .map((item) => item.id);
      const completed = await installWorkflows(options);
      expect(completed.ok).toBe(true);
      expect(configure.mock.calls.map((call) => call[2])).toEqual(["cursor"]);
      expect(completed.harnesses.filter((item) => item.status === "configured")).toMatchObject([
        { id: "cursor" },
      ]);
      expect([...installed]).toEqual(["claude", "codex", "cursor"]);
      expect(hooks.install).not.toHaveBeenCalled();
    },
  );

  it("deduplicates harness selections", async () => {
    const { hooks, options } = fixture();
    options.selected = ["claude", "claude"];
    expect((await installWorkflows(options)).harnesses).toHaveLength(1);
    expect(hooks.configure).toHaveBeenCalledTimes(1);
  });

  it.each([
    { selected: [], reason: "empty-selection" },
    { selected: ["invalid"], reason: "invalid-selection" },
    { selected: ["constructor"], reason: "invalid-selection" },
    { selected: [null], reason: "invalid-selection" },
    { selected: null, reason: "invalid-selection" },
    { selected: ["copilot", "opencode"], reason: "collision" },
    { selected: ["kiro", "kiro-ide"], reason: "collision" },
  ])("rejects $selected before installing or writing", async ({ selected, reason }) => {
    const { hooks, options } = fixture();
    options.selected = selected as HarnessId[];
    expect(await installWorkflows(options)).toMatchObject({ ok: false, reason });
    expectNoWrites(hooks);
  });

  it.each([
    { detected: "copilot", selected: "opencode" },
    { detected: "opencode", selected: "copilot" },
    { detected: "kiro", selected: "kiro-ide" },
    { detected: "kiro-ide", selected: "kiro" },
  ] as const)("rejects adding $selected to $detected", async ({ detected, selected }) => {
    const { hooks, options } = fixture({ detect: () => [detected] });
    options.selected = [selected];
    expect(await installWorkflows(options)).toMatchObject({ reason: "collision" });
    expectNoWrites(hooks);
  });

  it("checks Codex Git before installing anything", async () => {
    const { hooks, options } = fixture({ isGitRepository: vi.fn(async () => false) });
    options.selected = ["codex"];
    expect(await installWorkflows(options)).toMatchObject({ reason: "git-required" });
    expect(hooks.isGitRepository).toHaveBeenCalledExactlyOnceWith("/project", undefined);
    expectNoWrites(hooks);
  });

  it("uses the registered project pin instead of a different active runtime", async () => {
    const pinned = { ...machine, version: "2.8.0" };
    const { hooks, options } = fixture({
      readWorkspaceVersions: () => [],
      inspectPin: () => ({ exists: true, version: pinned.version }),
      readActive: (root) => (root ? pinned : machine),
      readInstall: () => pinned,
    });
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ ok: true, target: "2.8.0" });
    expect(vi.mocked(hooks.configure).mock.calls[0]?.[0]).toBe(pinned);
    expect(hooks.install).not.toHaveBeenCalled();
  });

  it.each([
    { versions: ["2.8.0", SETUP_RELEASE], pin: null, reason: "version-conflict" },
    { versions: ["2.8.0"], pin: SETUP_RELEASE, reason: "version-conflict" },
    { versions: [null], pin: null, reason: "version-unreadable" },
    { versions: [], pin: null, reason: "version-unreadable" },
    { versions: ["invalid"], pin: null, reason: "version-unreadable" },
    { versions: ["2.7.0"], pin: null, reason: "version-conflict" },
    { versions: ["2.8.0"], pin: null, reason: "version-conflict" },
  ])("preserves incompatible project state: $versions, $pin", async ({ versions, pin, reason }) => {
    const { hooks, options } = fixture({
      detect: () => ["claude"],
      readWorkspaceVersions: () => versions,
      inspectPin: () => ({ exists: pin !== null, version: pin }),
    });
    expect(await installWorkflows(options)).toMatchObject({ reason });
    expectNoWrites(hooks);
  });

  it("does not overwrite an unreadable project pin", async () => {
    const { hooks, options } = fixture({ inspectPin: () => ({ exists: true, version: null }) });
    expect(await installWorkflows(options)).toMatchObject({ reason: "pin-unreadable" });
    expectNoWrites(hooks);
  });

  it("does not repair a broken registered pin while adding harnesses", async () => {
    const { hooks, options } = fixture({
      inspectPin: () => ({ exists: true, version: SETUP_RELEASE }),
      readActive: (root) => (root ? null : machine),
    });
    expect(await installWorkflows(options)).toMatchObject({ reason: "pin-unavailable" });
    expectNoWrites(hooks);
  });

  it("does not activate an older pin while repairing its incomplete runtime", async () => {
    const pinned = { ...machine, version: "2.8.0" };
    const { hooks, options } = fixture({
      detect: () => ["claude"],
      readWorkspaceVersions: () => [pinned.version],
      inspectPin: () => ({ exists: true, version: pinned.version }),
      // The binary and registry resolve, but the retained runtime is incomplete.
      readActive: (root) => (root ? pinned : machine),
      readInstall: () => null,
    });
    expect(await installWorkflows(options)).toMatchObject({ reason: "pin-unavailable" });
    expectNoWrites(hooks);
  });

  it("installs an existing project version when no machine runtime is available", async () => {
    let installed = false;
    const existing = { ...machine, version: "2.8.0" };
    const install = vi.fn(async () => {
      installed = true;
    });
    const { hooks, options } = fixture({
      detect: () => ["claude"],
      readWorkspaceVersions: () => [existing.version],
      readActive: () => (installed ? existing : null),
      readInstall: () => (installed ? existing : null),
      install,
    });
    expect(await installWorkflows(options)).toMatchObject({ ok: true, target: existing.version });
    expect(install).toHaveBeenCalledExactlyOnceWith(options.log, undefined, fetch, "2.8.0", {});
    expect(hooks.configure).not.toHaveBeenCalled();
  });

  it("returns installer failures without attempting project writes", async () => {
    const { hooks, options } = fixture({
      readInstall: () => null,
      install: vi.fn(async () => {
        throw new Error("download failed");
      }),
    });
    expect(await installWorkflows(options)).toMatchObject({
      reason: "install-failed",
      message: expect.stringContaining("download failed"),
    });
    expect(hooks.configure).not.toHaveBeenCalled();
  });

  it("requires the runtime to be present after the installer succeeds", async () => {
    const { hooks, options } = fixture({ readInstall: () => null });
    expect(await installWorkflows(options)).toMatchObject({ reason: "missing-binary" });
    expect(hooks.install).toHaveBeenCalledTimes(1);
    expect(hooks.configure).not.toHaveBeenCalled();
  });

  it("stops before writing when already cancelled", async () => {
    const { hooks, options } = fixture();
    options.signal = AbortSignal.abort();
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ reason: "cancelled" });
    expect(result.harnesses.map((item) => item.status)).toEqual(["cancelled"]);
    expectNoWrites(hooks);
  });

  it("passes cancellation to the installer and stops before configuring", async () => {
    const cancellation = new AbortController();
    const install = vi.fn<typeof import("../src/native-setup.ts").installNative>(
      async (_log, _runner, _fetch, _version, options) => {
        expect(options?.signal).toBe(cancellation.signal);
        cancellation.abort();
      },
    );
    const { hooks, options } = fixture({ readInstall: () => null, install });
    options.signal = cancellation.signal;
    expect(await installWorkflows(options)).toMatchObject({ reason: "cancelled" });
    expect(hooks.configure).not.toHaveBeenCalled();
  });

  it("cancels an in-flight configuration", async () => {
    const cancellation = new AbortController();
    const configure = vi.fn<typeof configureNative>(async (_runtime, _root, id) => {
      if (id === "cursor") {
        cancellation.abort();
        throw new Error("cancelled");
      }
      return { doctorOk: true, details: "正常" };
    });
    const { options } = fixture({ configure });
    options.selected = ["cursor"];
    options.signal = cancellation.signal;
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ reason: "cancelled" });
    expect(result.harnesses.map((item) => item.status)).toEqual(["cancelled"]);
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure.mock.calls[0]?.[5]?.signal).toBe(cancellation.signal);
  });

  it("keeps completed tools when cancelled and does not start the remaining tools", async () => {
    const cancellation = new AbortController();
    const installed = new Set<HarnessId>();
    const configure = vi.fn<typeof configureNative>(async (_runtime, _root, id) => {
      if (id === "cursor") {
        cancellation.abort();
        throw new Error("cancelled");
      }
      installed.add(id);
      return { doctorOk: true, details: "正常" };
    });
    const { options } = fixture({ configure });
    options.selected = ["claude", "cursor", "codex"];
    options.signal = cancellation.signal;
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ ok: false, reason: "cancelled" });
    expect(result.harnesses).toMatchObject([
      { id: "claude", status: "configured" },
      { id: "cursor", status: "cancelled" },
      { id: "codex", status: "cancelled" },
    ]);
    expect([...installed]).toEqual(["claude"]);
    expect(configure.mock.calls.map((call) => call[2])).toEqual(["claude", "cursor"]);
    expect(options.onHarnessResult).toHaveBeenCalledTimes(3);
  });

  it("stops if the workspace changes during prerequisite inspection", async () => {
    let current = true;
    const { hooks, options } = fixture({
      isGitRepository: vi.fn(async () => {
        current = false;
        return true;
      }),
    });
    options.selected = ["codex"];
    options.isCurrent = () => current;
    expect(await installWorkflows(options)).toMatchObject({ reason: "cancelled" });
    expectNoWrites(hooks);
  });

  it("excludes concurrent installs for the same canonical root and releases afterwards", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const configure = vi.fn<typeof configureNative>(async () => {
      await promise;
      return { doctorOk: true, details: "正常" };
    });
    const { options } = fixture({ configure });
    const first = installWorkflows(options);
    const { hooks, options: secondOptions } = fixture();
    secondOptions.workspaceRoot = path.join(options.workspaceRoot, ".");
    expect(await installWorkflows(secondOptions)).toMatchObject({ reason: "busy" });
    expectNoWrites(hooks);
    resolve();
    expect((await first).ok).toBe(true);
    expect((await installWorkflows(secondOptions)).ok).toBe(true);
  });

  it("uses a fresh plan and preserves existing MCP settings", async () => {
    let revision = 0;
    const runner = vi.fn<SetupRunner>(async (_command, args) => {
      if (args.includes("--dry-run"))
        return {
          code: 0,
          stdout: JSON.stringify({ data: { planToken: `revision-${revision}` } }),
          stderr: "",
        };
      if (args[0] === "config") {
        expect(args).not.toContain("--mcp");
        expect(args[args.indexOf("--plan-token") + 1]).toBe(`revision-${revision}`);
        revision++;
      }
      return { code: 0, stdout: "ok", stderr: "" };
    });
    const { options } = fixture({
      configure: (runtime, root, id, log, _runner, nativeOptions) =>
        configureNative(runtime, root, id, log, runner, nativeOptions),
    });
    const result = await installWorkflows(options);
    expect(result.ok).toBe(true);
    expect(revision).toBe(1);
    expect(runner.mock.calls.map((call) => call[1][0])).toEqual(["config", "config", "doctor"]);
    expect(result.harnesses.every((item) => item.doctorReport !== undefined)).toBe(true);
  });

  it("detects a harness without a readable version instead of applying another harness's version", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-install-state-"));
    temporaryRoots.push(root);
    mkdirSync(path.join(root, ".claude", "skills", "aidlc"), { recursive: true });
    mkdirSync(path.join(root, ".cursor", "skills", "aidlc"), { recursive: true });
    mkdirSync(path.join(root, ".cursor", "tools"), { recursive: true });
    writeFileSync(
      path.join(root, ".cursor", "tools", "aidlc-version.ts"),
      `export const AIDLC_VERSION = "${SETUP_RELEASE}";`,
    );
    const { hooks, options } = fixture();
    delete (hooks as WorkflowsInstallHooks).detect;
    delete (hooks as WorkflowsInstallHooks).readWorkspaceVersions;
    options.workspaceRoot = root;
    options.selected = ["claude"];
    expect(await installWorkflows(options)).toMatchObject({ reason: "version-unreadable" });
    expectNoWrites(hooks);
  });
});
