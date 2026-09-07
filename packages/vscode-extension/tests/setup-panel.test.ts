import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  show: vi.fn().mockResolvedValue(undefined),
  update: vi.fn(),
}));
vi.mock("vscode", () => ({
  ViewColumn: { One: 1 },
  window: { showInformationMessage: mocks.show },
}));
vi.mock("../src/mcp-register.ts", () => ({
  refreshDocsRegistration: mocks.refresh,
  mcpScriptPath: () => "current.mjs",
  docsSkillPath: () => "skill.md",
  registerMcp: vi.fn(),
}));
vi.mock("../src/doctor.ts", () => ({ runDoctor: vi.fn() }));
vi.mock("../src/official-docs-root.ts", () => ({ resolveOfficialDocsRoot: vi.fn() }));

import { maybePromptSetup } from "../src/setup-panel.ts";

beforeEach(() => vi.clearAllMocks());
const context = {
  extensionPath: "extension",
  workspaceState: { get: () => true, update: mocks.update },
} as unknown as ExtensionContext;

describe("setup migration on activation", () => {
  it("offers setup when a previous setupDone flag hides missing Skills", async () => {
    mocks.refresh.mockResolvedValue({ complete: false, updated: false });
    await maybePromptSetup(context, "workspace");
    expect(mocks.refresh).toHaveBeenCalledWith("workspace", "current.mjs", "skill.md");
    expect(mocks.update).toHaveBeenCalledWith("aidlc-guide.setupDone", false);
    expect(mocks.show).toHaveBeenCalledWith(
      expect.stringContaining("追加または更新"),
      "Setup",
      "後で",
    );
  });
  it("marks complete only after both clients and Skills are current", async () => {
    mocks.refresh.mockResolvedValue({ complete: true, updated: false });
    await maybePromptSetup(context, "workspace");
    expect(mocks.update).toHaveBeenCalledWith("aidlc-guide.setupDone", true);
    expect(mocks.show).not.toHaveBeenCalled();
  });
  it("notifies a restart after migrating existing registrations", async () => {
    mocks.refresh.mockResolvedValue({ complete: true, updated: true });
    await maybePromptSetup(context, "workspace");
    expect(mocks.show).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("AI セッションを再起動"),
    );
  });
});
