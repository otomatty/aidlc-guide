import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDoctorOutput } from "../src/doctor-output.ts";

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  doctor: vi.fn(),
  plan: vi.fn(),
  apply: vi.fn(),
  git: vi.fn(),
}));
vi.mock("../src/native-setup.ts", async (original) => ({
  ...(await original<typeof import("../src/native-setup.ts")>()),
  configureNative: mocks.configure,
  runNativeDoctor: mocks.doctor,
}));
vi.mock("../src/native-harness-merge.ts", () => ({
  planHarnessCandidate: mocks.plan,
  applyHarnessCandidate: mocks.apply,
}));
vi.mock("../src/git-prerequisite.ts", async (original) => ({
  ...(await original<typeof import("../src/git-prerequisite.ts")>()),
  isGitRepository: mocks.git,
}));

import { assertNoActiveWorkflows, configureNativeHarness } from "../src/native-harness-install.ts";
import type { ConfigureNativeOptions, SetupRunner } from "../src/native-setup.ts";

const roots: string[] = [];
const install = { executable: "/runtime/aidlc", binDir: "/runtime/bin", version: "2.8.0" };
const doctorReport = parseDoctorOutput(
  { code: 0, stdout: "0 problems, 0 warnings.\nYour install is ready.\n", stderr: "" },
  install.version,
);

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "harness-install-test-"));
  roots.push(root);
  return root;
}

async function write(root: string, relative: string, value = ""): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
}

async function existingClaude(root: string): Promise<void> {
  await mkdir(path.join(root, ".claude", "skills", "aidlc"), { recursive: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configure.mockResolvedValue({
    doctorOk: true,
    details: "native",
    planToken: "native-plan",
  });
  mocks.doctor.mockResolvedValue(doctorReport);
  mocks.plan.mockResolvedValue({ planToken: "merge-plan" });
  mocks.apply.mockImplementation(async (_candidate, _root, _harness, _version, options) => {
    await options.validateLocked?.();
    options.onApplyStart?.();
  });
  mocks.git.mockResolvedValue(true);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("active workflow guard", () => {
  it("blocks an active record in an inactive space even without a registry", async () => {
    const root = await fixture();
    await write(
      root,
      "aidlc/spaces/archive/intents/task/aidlc-state.md",
      "- **Status**: In Progress\n",
    );
    await expect(assertNoActiveWorkflows(root)).rejects.toThrow("archive/task");
  });

  it("allows completed records and ignores registry rows without records", async () => {
    const root = await fixture();
    await write(
      root,
      "aidlc/spaces/default/intents/done/aidlc-state.md",
      "- **Status**: Completed\n",
    );
    await write(
      root,
      "aidlc/spaces/default/intents/intents.json",
      JSON.stringify([{ dirName: "missing", status: "active" }]),
    );
    await expect(assertNoActiveWorkflows(root)).resolves.toBeUndefined();
  });

  it("honors completion in modern and legacy registry entries", async () => {
    const root = await fixture();
    const intents = "aidlc/spaces/default/intents";
    await write(root, `${intents}/dated-task/aidlc-state.md`, "- **Status**: In Progress\n");
    await write(root, `${intents}/legacy-11223344/aidlc-state.md`, "- **Status**: In Progress\n");
    await write(
      root,
      `${intents}/intents.json`,
      JSON.stringify([
        { dirName: "dated-task", status: "complete" },
        { slug: "legacy", uuid: "00000000-0000-0000-0000-000011223344", status: "complete" },
      ]),
    );
    await expect(assertNoActiveWorkflows(root)).resolves.toBeUndefined();
  });

  it("does not let a malformed registry hide an active record", async () => {
    const root = await fixture();
    await write(root, "aidlc/spaces/default/intents/task/aidlc-state.md", "- **Status**: Paused\n");
    await write(root, "aidlc/spaces/default/intents/intents.json", "{broken");
    await expect(assertNoActiveWorkflows(root)).rejects.toThrow("default/task");
  });
});

describe("native harness installation", () => {
  it("keeps a normal first installation on the native path", async () => {
    const root = await fixture();
    const log = vi.fn();
    const options = { previewOnly: true };
    const runner = vi.fn<SetupRunner>();
    const result = await configureNativeHarness(install, root, "cursor", log, runner, options);
    expect(result.planToken).toBe("native-plan");
    expect(mocks.configure).toHaveBeenCalledExactlyOnceWith(
      install,
      root,
      "cursor",
      log,
      runner,
      options,
    );
    expect(mocks.plan).not.toHaveBeenCalled();
  });

  it("refreshes an existing native-managed tool directly when other tools are present", async () => {
    const root = await fixture();
    await existingClaude(root);
    await mkdir(path.join(root, ".cursor", "skills", "aidlc"), { recursive: true });
    const options = { previewOnly: true };
    await configureNativeHarness(install, root, "cursor", vi.fn(), undefined, options);
    expect(mocks.configure.mock.calls[0]?.[1]).toBe(root);
    expect(mocks.configure.mock.calls[0]?.[5]).toBe(options);
    expect(mocks.plan).not.toHaveBeenCalled();
  });

  it("generates policy-aware candidates and applies only their reviewed merge plan", async () => {
    const root = await fixture();
    await existingClaude(root);
    await write(root, "aidlc.settings.json", '{"schemaVersion":1}');
    await write(root, "aidlc/spaces/default/memory/org.md", "project policy");
    let candidate = "";
    mocks.configure.mockImplementation(async (_install, generatedRoot) => {
      candidate = generatedRoot;
      expect(candidate).not.toBe(root);
      expect(await readFile(path.join(candidate, "aidlc.settings.json"), "utf8")).toContain(
        "schemaVersion",
      );
      expect(
        await readFile(path.join(candidate, "aidlc/spaces/default/memory/org.md"), "utf8"),
      ).toBe("project policy");
      return { doctorOk: true, details: "candidate" };
    });
    const onApplyStart = vi.fn();
    const result = await configureNativeHarness(install, root, "cursor", vi.fn(), undefined, {
      onApplyStart,
    });
    expect(result.doctorReport).toEqual(doctorReport);
    expect(mocks.apply).toHaveBeenCalledWith(
      candidate,
      root,
      "cursor",
      install.version,
      expect.objectContaining({ planToken: "merge-plan" }),
    );
    expect(onApplyStart).toHaveBeenCalledOnce();
    expect(mocks.doctor.mock.calls[0]?.[1]).toBe(root);
    expect(existsSync(candidate)).toBe(false);
    expect(await readFile(path.join(root, "aidlc/spaces/default/memory/org.md"), "utf8")).toBe(
      "project policy",
    );
  });

  it("returns a merge token for preview without applying to the project", async () => {
    const root = await fixture();
    await existingClaude(root);
    const result = await configureNativeHarness(install, root, "cursor", vi.fn(), undefined, {
      previewOnly: true,
    });
    expect(result.planToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.doctor).not.toHaveBeenCalled();
    expect(existsSync(mocks.configure.mock.calls[0]?.[1])).toBe(false);
  });

  it("generates from the selected retained release when the global runtime is another version", async () => {
    const root = await fixture();
    await existingClaude(root);
    vi.stubEnv("AIDLC_RUNTIME_ROOT", "/machine/versions/2.8.1/runtime");
    const retained = { ...install, executable: "/machine/versions/2.8.0/aidlc" };
    await configureNativeHarness(retained, root, "cursor", vi.fn());
    expect(mocks.configure.mock.calls[0]?.[0]).toBe(retained);
    expect(mocks.configure.mock.calls[0]?.[5]).toEqual({
      sourceRoot: path.join(path.dirname(retained.executable), "runtime", "cursor"),
    });
    expect(mocks.plan.mock.calls[0]?.[3]).toBe("2.8.0");
  });

  it("rejects a stale plan and cleans up the regenerated candidate", async () => {
    const root = await fixture();
    await existingClaude(root);
    await expect(
      configureNativeHarness(install, root, "cursor", vi.fn(), undefined, {
        planToken: "old-plan",
      }),
    ).rejects.toThrow("確認後");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(existsSync(mocks.configure.mock.calls[0]?.[1])).toBe(false);
  });

  it("includes project policy inputs in the token even when the generated merge is unchanged", async () => {
    const root = await fixture();
    await existingClaude(root);
    const preview = await configureNativeHarness(install, root, "cursor", vi.fn(), undefined, {
      previewOnly: true,
    });
    await write(root, "aidlc.settings.json", '{"schemaVersion":1}');
    await expect(
      configureNativeHarness(install, root, "cursor", vi.fn(), undefined, {
        planToken: preview.planToken,
      }),
    ).rejects.toThrow("確認後");
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("stops when settings change between generation and the locked commit", async () => {
    const root = await fixture();
    await existingClaude(root);
    mocks.plan.mockImplementation(async () => {
      await write(root, "aidlc/active-space", "default\n");
      return { planToken: "merge-plan" };
    });
    const onApplyStart = vi.fn();
    await expect(
      configureNativeHarness(install, root, "cursor", vi.fn(), undefined, { onApplyStart }),
    ).rejects.toThrow("確認後");
    expect(onApplyStart).not.toHaveBeenCalled();
  });

  it("uses the native space command for non-default rules and records the generated include hashes", async () => {
    const root = await fixture();
    await existingClaude(root);
    await write(root, "aidlc/active-space", "custom\n");
    await write(root, "aidlc/spaces/custom/memory/team.md", "custom policy");
    const rel = ".cursor/rules/aidlc.mdc";
    mocks.configure.mockImplementation(async (_install, candidate) => {
      expect(await readFile(path.join(candidate, "aidlc/active-space"), "utf8")).toBe("custom\n");
      await write(candidate, rel, "aidlc/spaces/default/memory/team.md\n");
      await write(
        candidate,
        ".cursor/tools/data/aidlc-manifest.json",
        JSON.stringify({ files: { [rel]: "prior-hash" }, rootContributions: {} }),
      );
      return { doctorOk: true, details: "candidate" };
    });
    const runner = vi
      .fn<SetupRunner>()
      .mockImplementation(async (_command, args, candidate, env) => {
        expect(args).toEqual(["engine", "space", "switch", "custom", "--project-dir", candidate]);
        expect(env?.AIDLC_HARNESS_DIR).toBe(".cursor");
        await write(candidate, rel, "aidlc/spaces/custom/memory/team.md\n");
        return { code: 0, stdout: "repointed", stderr: "" };
      });
    mocks.plan.mockImplementation(async (candidate) => {
      const baseline = JSON.parse(
        await readFile(path.join(candidate, ".cursor/tools/data/aidlc-manifest.json"), "utf8"),
      );
      const bytes = await readFile(path.join(candidate, rel));
      expect(baseline.files[rel]).toBe(
        `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      );
      return { planToken: "merge-plan" };
    });
    await configureNativeHarness(install, root, "cursor", vi.fn(), runner);
    expect(runner).toHaveBeenCalledOnce();
  });

  it("rechecks workflow status while holding the merge lock", async () => {
    const root = await fixture();
    await existingClaude(root);
    mocks.plan.mockImplementation(async () => {
      await write(
        root,
        "aidlc/spaces/default/intents/new/aidlc-state.md",
        "- **Status**: In Progress\n",
      );
      return { planToken: "merge-plan" };
    });
    const onApplyStart = vi.fn();
    await expect(
      configureNativeHarness(install, root, "cursor", vi.fn(), undefined, { onApplyStart }),
    ).rejects.toThrow("default/new");
    expect(onApplyStart).not.toHaveBeenCalled();
    expect(mocks.doctor).not.toHaveBeenCalled();
  });

  it("requires the actual repository before creating a Codex candidate", async () => {
    const root = await fixture();
    await existingClaude(root);
    mocks.git.mockResolvedValue(false);
    await expect(configureNativeHarness(install, root, "codex", vi.fn())).rejects.toThrow(
      "Git リポジトリ",
    );
    expect(mocks.configure).not.toHaveBeenCalled();
  });

  it("initializes Git only inside the Codex candidate and scopes final doctor to Codex", async () => {
    const root = await fixture();
    await existingClaude(root);
    const runner = vi.fn<SetupRunner>().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await configureNativeHarness(install, root, "codex", vi.fn(), runner);
    const candidate = mocks.configure.mock.calls[0]?.[1];
    expect(runner.mock.calls[0]?.slice(0, 3)).toEqual([
      "git",
      ["init", "--quiet", candidate],
      candidate,
    ]);
    expect(mocks.git).toHaveBeenCalledTimes(2);
    const selectedRunner = mocks.doctor.mock.calls[0]?.[2] as SetupRunner;
    await selectedRunner("aidlc", ["doctor"], root, {});
    expect(runner.mock.calls.at(-1)?.[3]?.AIDLC_HARNESS_DIR).toBe(".codex");
  });

  it("uses the candidate path for an existing Guide-managed single tool", async () => {
    const root = await fixture();
    await write(root, ".cursor/tools/data/aidlc-guide-install.json", "{}");
    await configureNativeHarness(install, root, "cursor", vi.fn());
    expect(mocks.configure.mock.calls[0]?.[1]).not.toBe(root);
    expect(mocks.apply).toHaveBeenCalledOnce();
  });

  it("cleans up after candidate generation fails or is cancelled", async () => {
    for (const cancelled of [false, true]) {
      const root = await fixture();
      await existingClaude(root);
      const abort = new AbortController();
      let candidate = "";
      mocks.configure.mockImplementation(async (_install, generatedRoot) => {
        candidate = generatedRoot;
        if (cancelled) abort.abort();
        else throw new Error("generation failed");
        return { doctorOk: true, details: "candidate" };
      });
      const options: ConfigureNativeOptions = { signal: abort.signal };
      await expect(
        configureNativeHarness(install, root, "cursor", vi.fn(), undefined, options),
      ).rejects.toThrow();
      expect(existsSync(candidate)).toBe(false);
    }
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
