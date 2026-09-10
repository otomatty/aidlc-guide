import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({ docs: vi.fn(), native: vi.fn(), git: vi.fn() }));
vi.mock("vscode", () => ({ workspace: { isTrusted: true } }));
vi.mock("../src/git-prerequisite.ts", async (original) => ({
  ...(await original<typeof import("../src/git-prerequisite.ts")>()),
  isGitRepository: mocks.git,
}));
vi.mock("../src/mcp-register.ts", () => ({
  refreshDocsRegistration: mocks.docs,
  mcpScriptPath: () => "script",
  docsSkillPath: () => "skill",
}));
vi.mock("../src/native-setup.ts", () => ({ readNativeInstall: mocks.native }));

import { detectHarnesses } from "../src/harness-detect.ts";
import { readNativeProjections } from "../src/native-projection.ts";
import { inspectSetup, needsSetup, setupStateKey } from "../src/setup-state.ts";
import { readWorkspaceAidlcVersion } from "../src/workflows-version.ts";

const roots: string[] = [];
const get = vi.fn();
const context = {
  extensionPath: "extension",
  workspaceState: { get },
} as unknown as ExtensionContext;
beforeEach(() => {
  get.mockReset();
  mocks.git.mockResolvedValue(true);
  mocks.docs.mockResolvedValue({ complete: false });
  mocks.native.mockReturnValue(null);
});
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(native: boolean): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "setup-state-"));
  roots.push(root);
  await mkdir(path.join(root, "aidlc", "spaces", "default"), { recursive: true });
  await mkdir(path.join(root, ".codex", "tools", "data"), { recursive: true });
  await writeFile(
    path.join(root, ".codex", "tools", native ? "data/aidlc-stamp.json" : "aidlc-version.ts"),
    native
      ? JSON.stringify({ schemaVersion: 1, frameworkVersion: "2.8.1", distribution: "codex" })
      : 'export const AIDLC_VERSION = "2.8.0";',
  );
  return root;
}
describe("first-run setup state", () => {
  it("requires Git for a configured Codex projection even after prior completion", async () => {
    const root = await fixture(true);
    mocks.native.mockReturnValue({ executable: "/user/aidlc", version: "2.8.1", binDir: "/bin" });
    get.mockReturnValue({ completed: true, docsSkipped: true, harness: "codex" });
    mocks.git.mockResolvedValue(false);
    const state = await inspectSetup(context, root);
    expect(state.configured).toBe(false);
    expect(state.runtimeIssue).toContain("git init");
    expect(needsSetup(state)).toBe(true);
    mocks.git.mockResolvedValue(true);
    expect(needsSetup(await inspectSetup(context, root))).toBe(false);
  });
  it.each([undefined, "2.8", "02.8.1", 281])(
    "ignores an invalid native version (%s) and retains legacy detection",
    async (frameworkVersion) => {
      const root = await fixture(true);
      const stamp = path.join(root, ".codex", "tools", "data", "aidlc-stamp.json");
      await writeFile(
        stamp,
        JSON.stringify({ schemaVersion: 1, distribution: "codex", frameworkVersion }),
      );
      expect(readNativeProjections(root)).toEqual([]);
      expect(detectHarnesses(root).harnesses).toEqual([]);
      await writeFile(
        path.join(root, ".codex", "tools", "aidlc-version.ts"),
        'export const AIDLC_VERSION = "2.8.0";',
      );
      expect(readWorkspaceAidlcVersion(root).version).toBe("2.8.0");
    },
  );
  it("reopens when previously enabled docs are removed", async () => {
    get.mockReturnValue({ completed: true, docsSkipped: false, harness: "codex" });
    expect(needsSetup(await inspectSetup(context, await fixture(false)))).toBe(true);
  });
  it("does not accept a machine version different from a native projection", async () => {
    const root = await fixture(true);
    get.mockReturnValue({ completed: true, docsSkipped: true });
    mocks.native.mockReturnValue({
      executable: "/user/aidlc",
      version: "2.8.0",
      binDir: "/user/bin",
    });
    const state = await inspectSetup(context, root);
    expect(mocks.native).toHaveBeenCalledWith(root);
    expect(state.configured).toBe(false);
    expect(state.runtimeIssue).toContain("aidlc config --pin");
    expect(needsSetup(state)).toBe(true);
  });
  it("requires every native projection to match the selected runtime", async () => {
    const root = await fixture(true);
    await mkdir(path.join(root, ".cursor", "tools", "data"), { recursive: true });
    await writeFile(
      path.join(root, ".cursor", "tools", "data", "aidlc-stamp.json"),
      JSON.stringify({ schemaVersion: 1, distribution: "cursor", frameworkVersion: "2.8.2" }),
    );
    mocks.native.mockReturnValue({
      executable: "/user/aidlc",
      version: "2.8.1",
      binDir: "/user/bin",
    });
    expect((await inspectSetup(context, root)).configured).toBe(false);
  });
  it("opens for an empty project regardless of an old setupDone flag", async () => {
    get.mockReturnValue({ completed: true });
    const root = await mkdtemp(path.join(tmpdir(), "setup-empty-"));
    roots.push(root);
    expect(needsSetup(await inspectSetup(context, root))).toBe(true);
  });
  it("allows completion with no Intent and remembers an explicit skip of optional docs", async () => {
    const root = await fixture(false);
    get.mockReturnValue({ completed: true, docsSkipped: true, harness: "codex" });
    const state = await inspectSetup(context, root);
    expect(state.configured).toBe(true);
    expect(needsSetup(state)).toBe(false);
    expect(get).toHaveBeenCalledWith(setupStateKey(root));
  });
  it("recognizes a previous complete registration without forcing another first run", async () => {
    mocks.docs.mockResolvedValue({ complete: true });
    expect(needsSetup(await inspectSetup(context, await fixture(false)))).toBe(false);
  });
  it("reopens unfinished setup and reads native metadata without TypeScript source files", async () => {
    const root = await fixture(true);
    mocks.native.mockReturnValue({
      executable: "/user/aidlc",
      version: "2.8.1",
      binDir: "/user/bin",
    });
    const state = await inspectSetup(context, root);
    expect(state.configured).toBe(true);
    expect(needsSetup(state)).toBe(true);
    expect(detectHarnesses(root).harnesses.map((h) => h.id)).toContain("codex");
    expect(readWorkspaceAidlcVersion(root).version).toBe("2.8.1");
    await writeFile(
      path.join(root, ".codex", "tools", "aidlc-version.ts"),
      'export const AIDLC_VERSION = "2.7.0";',
    );
    expect(readWorkspaceAidlcVersion(root).version).toBe("2.8.1");
  });
  it("does not call a native project ready after its machine runtime has been removed", async () => {
    get.mockReturnValue({ completed: true });
    expect(needsSetup(await inspectSetup(context, await fixture(true)))).toBe(true);
  });
});
