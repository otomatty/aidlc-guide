import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findHarnessConflict } from "../src/harness-conflicts.ts";
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
    use: vi.fn(async () => {}),
    pin: vi.fn(async () => {}),
    unpin: vi.fn(async () => {}),
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
  expect(hooks.use).not.toHaveBeenCalled();
  expect(hooks.pin).not.toHaveBeenCalled();
  expect(hooks.configure).not.toHaveBeenCalled();
}

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("installWorkflows", () => {
  it.each(
    [null, "2.8.0"].flatMap((previousPin) =>
      ["pin-abort", "pin-error", "preview-abort", "preview-error", "write-abort", "partial"].map(
        (stop) => ({ previousPin, stop }),
      ),
    ),
  )(
    "preserves pin ownership at $stop with previous pin $previousPin",
    async ({ previousPin, stop }) => {
      const root = mkdtempSync(path.join(tmpdir(), "workflows-install-rollback-"));
      temporaryRoots.push(root);
      const pinPath = path.join(root, ".aidlc-version");
      if (previousPin) writeFileSync(pinPath, previousPin);
      const readPin = () => (existsSync(pinPath) ? readFileSync(pinPath, "utf8") : null);
      const cancellation = new AbortController();
      const previousMachine = { ...machine, version: "2.9.0" };
      const cleanup: string[] = [];
      const { hooks, options } = fixture({
        inspectPin: () => ({ exists: readPin() !== null, version: readPin() }),
        readActive: (project) =>
          project && readPin() === SETUP_RELEASE ? machine : previousMachine,
        pin: vi.fn(async (_runtime, _root, version, _log, _runner, commandOptions) => {
          writeFileSync(pinPath, version);
          if (version !== SETUP_RELEASE) {
            expect(commandOptions?.signal).toBeUndefined();
            cleanup.push(version);
            return;
          }
          expect(commandOptions?.signal).toBe(cancellation.signal);
          if (stop === "pin-abort") cancellation.abort();
          if (stop.startsWith("pin-")) throw new Error("pin committed before command failed");
        }),
        unpin: vi.fn(async (_runtime, _root, _log, _runner, commandOptions) => {
          expect(commandOptions?.signal).toBeUndefined();
          rmSync(pinPath);
          cleanup.push("absent");
        }),
        configure: vi.fn(async (_runtime, _root, id, _log, _runner, commandOptions) => {
          if (stop.startsWith("preview-")) {
            if (stop === "preview-abort") cancellation.abort();
            throw new Error("preflight stopped before files changed");
          }
          commandOptions?.onApplyStart?.();
          writeFileSync(path.join(root, `${id}.configured`), SETUP_RELEASE);
          if (stop === "write-abort") {
            cancellation.abort();
            throw new Error("aborted after a file write");
          }
          if (id === "cursor") throw new Error("second tool failed");
          return { doctorOk: true, details: "ok" };
        }),
      });
      const result = await installWorkflows({
        ...options,
        workspaceRoot: root,
        selected: ["claude", "cursor"],
        signal: cancellation.signal,
        isCurrent: () => !cancellation.signal.aborted,
        canRestore: () => true,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        stop.endsWith("abort")
          ? "cancelled"
          : stop === "pin-error"
            ? "pin-failed"
            : "configure-failed",
      );
      const written = stop === "write-abort" || stop === "partial";
      expect(readPin()).toBe(written ? SETUP_RELEASE : previousPin);
      expect(existsSync(path.join(root, "claude.configured"))).toBe(written);
      expect(cleanup).toEqual(written ? [] : [previousPin ?? "absent"]);
      expect(hooks.use).not.toHaveBeenCalled();
      if (stop.startsWith("pin-")) expect(hooks.configure).not.toHaveBeenCalled();
    },
  );
  it.each(["unavailable-folder", "cleanup-failure"])(
    "handles rollback %s and releases the operation lock",
    async (stop) => {
      const cancellation = new AbortController();
      const { hooks, options } = fixture({
        readActive: () => ({ ...machine, version: "2.9.0" }),
        pin: vi.fn(async () => {
          cancellation.abort();
        }),
        unpin: vi.fn(async () => {
          throw new Error("restore refused");
        }),
      });
      const result = await installWorkflows({
        ...options,
        signal: cancellation.signal,
        canRestore: () => stop !== "unavailable-folder",
      });
      expect(result.reason).toBe(stop === "cleanup-failure" ? "restore-failed" : "cancelled");
      expect(hooks.unpin).toHaveBeenCalledTimes(stop === "cleanup-failure" ? 1 : 0);
      expect((await installWorkflows(fixture().options)).ok).toBe(true);
    },
  );
  it.each([
    { hasPin: false, startsDuringInstall: false },
    { hasPin: true, startsDuringInstall: false },
    { hasPin: false, startsDuringInstall: true },
    { hasPin: true, startsDuringInstall: true },
  ])(
    "preserves the pin when an active workflow exists (pin: $hasPin, starts during install: $startsDuringInstall)",
    async ({ hasPin, startsDuringInstall }) => {
      const root = mkdtempSync(path.join(tmpdir(), "workflows-active-pin-"));
      temporaryRoots.push(root);
      const pinPath = path.join(root, ".aidlc-version");
      if (hasPin) writeFileSync(pinPath, "2.8.0");
      const startWorkflow = () => {
        const record = path.join(root, "aidlc", "spaces", "default", "intents", "active-12345678");
        mkdirSync(record, { recursive: true });
        writeFileSync(path.join(record, "aidlc-state.md"), "- **Status**: In Progress\n");
      };
      if (!startsDuringInstall) startWorkflow();
      const previous = { ...machine, version: "2.9.0" };
      let active = previous;
      let installed = false;
      const { hooks, options } = fixture({
        inspectPin: () => ({ exists: hasPin, version: hasPin ? "2.8.0" : null }),
        readActive: () => active,
        readInstall: () => (installed ? machine : null),
        install: vi.fn(async () => {
          installed = true;
          active = machine;
          startWorkflow();
        }),
        use: vi.fn(async () => {
          active = previous;
        }),
      });
      expect(await installWorkflows({ ...options, workspaceRoot: root })).toMatchObject({
        ok: false,
        reason: "preflight-failed",
      });
      expect(hooks.install).toHaveBeenCalledTimes(startsDuringInstall ? 1 : 0);
      expect(hooks.pin).not.toHaveBeenCalled();
      expect(hooks.configure).not.toHaveBeenCalled();
      expect(active).toBe(previous);
      expect(existsSync(pinPath)).toBe(hasPin);
      if (hasPin) expect(readFileSync(pinPath, "utf8")).toBe("2.8.0");
    },
  );
  it.each([
    { pinned: "2.8.0", retained: false },
    { pinned: "2.8.0", retained: true },
    { pinned: SETUP_RELEASE, retained: false },
    { pinned: SETUP_RELEASE, retained: true },
  ])(
    "initializes a pin-only project at $pinned (target retained: $retained)",
    async ({ pinned, retained }) => {
      const previous = { ...machine, version: "2.9.0" };
      let active = previous;
      let installed = retained;
      let registered = false;
      const { hooks, options } = fixture({
        inspectPin: () => ({ exists: true, version: pinned }),
        readActive: (root) => (root ? (registered ? machine : null) : active),
        readInstall: () => (installed ? machine : null),
        install: vi.fn(async () => {
          installed = true;
          active = machine;
        }),
        use: vi.fn(async () => {
          active = previous;
        }),
        pin: vi.fn(async () => {
          registered = true;
        }),
        configure: vi.fn<typeof configureNative>(async (runtime) => {
          expect(runtime).toBe(machine);
          expect(registered).toBe(true);
          expect(active).toBe(previous);
          return { doctorOk: true, details: "正常" };
        }),
      });
      expect(await installWorkflows(options)).toMatchObject({ ok: true, target: SETUP_RELEASE });
      expect(hooks.install).toHaveBeenCalledTimes(retained ? 0 : 1);
      expect(hooks.pin).toHaveBeenCalledExactlyOnceWith(
        machine,
        options.workspaceRoot,
        SETUP_RELEASE,
        options.log,
        undefined,
        {},
      );
      expect(hooks.configure).toHaveBeenCalledOnce();
      expect(active).toBe(previous);
    },
  );
  it("keeps a pin-only project unchanged when an active workflow remains", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "workflows-pin-only-"));
    temporaryRoots.push(root);
    const record = path.join(root, "aidlc", "spaces", "default", "intents", "active-12345678");
    mkdirSync(record, { recursive: true });
    writeFileSync(path.join(record, "aidlc-state.md"), "- **Status**: In Progress\n");
    const { hooks, options } = fixture({ inspectPin: () => ({ exists: true, version: "2.8.0" }) });
    expect(await installWorkflows({ ...options, workspaceRoot: root })).toMatchObject({
      ok: false,
      reason: "preflight-failed",
    });
    expectNoWrites(hooks);
  });
  it.each(["2.9.0", "invalid"])("refuses a pin-only project at %s", async (version) => {
    const { hooks, options } = fixture({ inspectPin: () => ({ exists: true, version }) });
    expect((await installWorkflows(options)).ok).toBe(false);
    expectNoWrites(hooks);
  });
  it("does not adopt an older pin when leftover version files remain", async () => {
    const { hooks, options } = fixture({
      inspectPin: () => ({ exists: true, version: "2.8.0" }),
      readWorkspaceVersions: () => ["2.8.0"],
    });
    expect(await installWorkflows(options)).toMatchObject({ reason: "version-conflict" });
    expectNoWrites(hooks);
  });
  it.each([
    { version: "2.8.0", retained: false },
    { version: "2.9.0", retained: false },
    { version: "2.8.0", retained: true },
    { version: "2.9.0", retained: true },
  ])(
    "preserves machine $version and pins the project to the common release (retained: $retained)",
    async ({ version, retained }) => {
      const previous = { ...machine, version };
      let active = previous;
      let installed = retained;
      let pinned = false;
      const install = vi.fn(async () => {
        installed = true;
        active = machine;
      });
      const { hooks, options } = fixture({
        readActive: (root) => (root && pinned ? machine : active),
        readInstall: () => (installed ? machine : null),
        install,
        use: vi.fn(async () => {
          active = previous;
        }),
        pin: vi.fn(async () => {
          pinned = true;
        }),
        configure: vi.fn(async () => {
          expect(active).toBe(previous);
          expect(pinned).toBe(true);
          return { doctorOk: true, details: "診断済み" };
        }),
      });
      expect(await installWorkflows(options)).toMatchObject({ ok: true, target: SETUP_RELEASE });
      if (retained) {
        expect(install).not.toHaveBeenCalled();
        expect(hooks.use).not.toHaveBeenCalled();
      } else {
        expect(install).toHaveBeenCalledExactlyOnceWith(
          options.log,
          undefined,
          fetch,
          SETUP_RELEASE,
          {},
        );
        expect(hooks.use).toHaveBeenCalledExactlyOnceWith(previous, version, options.log);
      }
      expect(hooks.pin).toHaveBeenCalledExactlyOnceWith(
        machine,
        options.workspaceRoot,
        SETUP_RELEASE,
        options.log,
        undefined,
        {},
      );
      expect(vi.mocked(hooks.configure).mock.calls[0]?.[0].version).toBe(SETUP_RELEASE);
      expect(active).toBe(previous);
    },
  );
  it.each(["failure", "cancellation"])(
    "restores the machine default after installer %s",
    async (outcome) => {
      const previous = { ...machine, version: "2.9.0" };
      let active = previous;
      const controller = new AbortController();
      const { hooks, options } = fixture({
        readActive: () => active,
        readInstall: () => null,
        install: vi.fn(async () => {
          active = machine;
          if (outcome === "cancellation") controller.abort();
          throw new Error("installer stopped");
        }),
        use: vi.fn(async () => {
          active = previous;
        }),
      });
      expect(await installWorkflows({ ...options, signal: controller.signal })).toMatchObject({
        ok: false,
        reason: outcome === "cancellation" ? "cancelled" : "install-failed",
      });
      expect(hooks.use).toHaveBeenCalledExactlyOnceWith(previous, previous.version, options.log);
      expect(active).toBe(previous);
      expect(hooks.pin).not.toHaveBeenCalled();
      expect(hooks.configure).not.toHaveBeenCalled();
    },
  );
  it.each(["throws", "does not restore"])(
    "stops when restoring the machine default %s",
    async (outcome) => {
      let active = { ...machine, version: "2.9.0" };
      const { hooks, options } = fixture({
        readActive: () => active,
        readInstall: () => null,
        install: vi.fn(async () => {
          active = machine;
        }),
        use: vi.fn(async () => {
          if (outcome === "throws") throw new Error("restore failed");
        }),
      });
      expect(await installWorkflows(options)).toMatchObject({
        ok: false,
        reason: "restore-failed",
      });
      expect(hooks.pin).not.toHaveBeenCalled();
      expect(hooks.configure).not.toHaveBeenCalled();
    },
  );
  it.each(["throws", "does not register"])(
    "does not configure a new project when pinning %s",
    async (outcome) => {
      const previous = { ...machine, version: "2.9.0" };
      const { hooks, options } = fixture({
        readActive: () => previous,
        pin: vi.fn(async () => {
          if (outcome === "throws") throw new Error("pin failed");
        }),
      });
      expect(await installWorkflows(options)).toMatchObject({
        ok: false,
        reason: outcome === "throws" ? "pin-failed" : "pin-unavailable",
      });
      expect(hooks.install).not.toHaveBeenCalled();
      expect(hooks.use).not.toHaveBeenCalled();
      expect(hooks.configure).not.toHaveBeenCalled();
    },
  );
  it("requires unfinished updates to complete before adding tools", async () => {
    const { hooks, options } = fixture();
    expect(await installWorkflows({ ...options, needsRepair: true })).toMatchObject({
      ok: false,
      reason: "version-conflict",
    });
    expectNoWrites(hooks);
  });
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
      expect(call[5]).toEqual({ mcp: "preserve", onApplyStart: expect.any(Function) });
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

  it.each([SETUP_RELEASE])(
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
    expect(await installWorkflows(options)).toMatchObject({
      reason: "collision",
      message: findHarnessConflict([detected, selected])?.message,
    });
    expectNoWrites(hooks);
  });

  it("checks Codex Git before installing anything", async () => {
    const { hooks, options } = fixture({ isGitRepository: vi.fn(async () => false) });
    options.selected = ["codex"];
    expect(await installWorkflows(options)).toMatchObject({ reason: "git-required" });
    expect(hooks.isGitRepository).toHaveBeenCalledExactlyOnceWith("/project", undefined);
    expectNoWrites(hooks);
  });

  it("requires an older project pin to be updated before adding tools", async () => {
    const pinned = { ...machine, version: "2.8.0" };
    const { hooks, options } = fixture({
      detect: () => ["claude"],
      readWorkspaceVersions: () => [pinned.version],
      inspectPin: () => ({ exists: true, version: pinned.version }),
      readActive: (root) => (root ? pinned : machine),
      readInstall: () => pinned,
    });
    const result = await installWorkflows(options);
    expect(result).toMatchObject({ ok: false, target: SETUP_RELEASE, reason: "version-conflict" });
    expectNoWrites(hooks);
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
      detect: () => ["claude"],
      readWorkspaceVersions: () => [SETUP_RELEASE],
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
    expect(await installWorkflows(options)).toMatchObject({ reason: "version-conflict" });
    expectNoWrites(hooks);
  });

  it("requires updating an old project even when no machine runtime is available", async () => {
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
    expect(await installWorkflows(options)).toMatchObject({
      ok: false,
      reason: "version-conflict",
      target: SETUP_RELEASE,
    });
    expectNoWrites(hooks);
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
