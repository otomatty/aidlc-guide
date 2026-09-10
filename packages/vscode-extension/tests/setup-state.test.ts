import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({ docs: vi.fn(), native: vi.fn() }));
vi.mock("../src/mcp-register.ts", () => ({
  refreshDocsRegistration: mocks.docs,
  mcpScriptPath: () => "script",
  docsSkillPath: () => "skill",
}));
vi.mock("../src/native-setup.ts", () => ({ readNativeInstall: mocks.native }));

import { detectHarnesses } from "../src/harness-detect.ts";
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
