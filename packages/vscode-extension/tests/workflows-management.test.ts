import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WORKFLOWS_TARGET_VERSION } from "@aidlc-guide/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installWorkflows } from "../src/workflows-install.ts";
import { inspectWorkflowsManagement } from "../src/workflows-management.ts";
import { acquireWorkflowsOperation } from "../src/workflows-operation.ts";

const mocks = vi.hoisted(() => ({ apply: vi.fn(), doctor: vi.fn(), runtime: vi.fn() }));
vi.mock("../src/workflows-native-update.ts", () => ({ applyNativeWorkflowsUpdate: mocks.apply }));
vi.mock("../src/native-setup.ts", async (original) => ({
  ...(await original<typeof import("../src/native-setup.ts")>()),
  runNativeDoctor: mocks.doctor,
  readNativeInstall: mocks.runtime,
}));

import { updateInstalledWorkflows } from "../src/workflows-update.ts";

let root: string;
const target = WORKFLOWS_TARGET_VERSION;
function tool(id: "claude" | "cursor", version: string) {
  const dir = path.join(root, `.${id}`, "tools", "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "aidlc-stamp.json"),
    JSON.stringify({ schemaVersion: 1, distribution: id, frameworkVersion: version }),
  );
}
function pin(version: string) {
  writeFileSync(path.join(root, ".aidlc-version"), version);
}
function options() {
  return {
    workspaceRoot: root,
    log: vi.fn(),
    isCurrent: () => true,
    canRestore: () => true,
    needsRepair: false,
    setNeedsRepair: vi.fn(async (_value: boolean) => {}),
    onHarnessResult: vi.fn(),
  };
}
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "workflows-management-"));
  vi.clearAllMocks();
  mocks.runtime.mockReturnValue({ executable: "runtime", version: target, binDir: "bin" });
  mocks.doctor.mockResolvedValue({
    outcome: "ok",
    summary: "正常",
    checks: [],
    unparsedOutput: [],
    rawOutput: "",
    counts: null,
  });
  mocks.apply.mockImplementation(async () => {
    for (const entry of inspectWorkflowsManagement(root).tools)
      tool(entry.id as "claude" | "cursor", target);
    pin(target);
    return { ok: true, target };
  });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("shared workflows management", () => {
  it("uses the same release for installation, state and 2.8.0 updates", () => {
    expect(inspectWorkflowsManagement(root)).toMatchObject({
      target,
      status: "not-installed",
      canInstall: true,
      canUpdate: false,
    });
    tool("claude", "2.8.0");
    expect(inspectWorkflowsManagement(root)).toMatchObject({
      target,
      status: "update",
      canInstall: false,
      canUpdate: true,
    });
    tool("claude", target);
    expect(inspectWorkflowsManagement(root)).toMatchObject({
      status: "current",
      canInstall: true,
      canUpdate: false,
    });
  });
  it("checks every installed tool and the project pin before permitting writes", () => {
    tool("claude", "2.8.0");
    tool("cursor", target);
    expect(inspectWorkflowsManagement(root).canUpdate).toBe(true);
    tool("cursor", "2.9.0");
    expect(inspectWorkflowsManagement(root)).toMatchObject({
      status: "blocked",
      canUpdate: false,
      canInstall: false,
    });
    tool("cursor", target);
    pin("2.9.0");
    expect(inspectWorkflowsManagement(root).status).toBe("blocked");
    pin("invalid");
    expect(inspectWorkflowsManagement(root).message).toContain("固定版");
  });
  it("does not hide a detected tool with no readable version", () => {
    tool("cursor", target);
    mkdirSync(path.join(root, ".claude", "skills", "aidlc"), { recursive: true });
    const state = inspectWorkflowsManagement(root);
    expect(state.tools.find((entry) => entry.id === "claude")?.version).toBeNull();
    expect(state.status).toBe("blocked");
  });
  it("does not use a bundled document version as its update target", () => {
    mkdirSync(path.join(root, "docs"));
    writeFileSync(
      path.join(root, "docs", "official-docs.manifest.json"),
      JSON.stringify({ sourceVersion: "9.0.0" }),
    );
    tool("claude", "2.8.0");
    expect(inspectWorkflowsManagement(root)).toMatchObject({ target, canUpdate: true });
  });

  it("allows repairing a matching project whose machine runtime or pin registration is missing", () => {
    tool("claude", target);
    pin(target);
    mocks.runtime.mockReturnValue(null);
    expect(inspectWorkflowsManagement(root)).toMatchObject({ canUpdate: true, canInstall: false });
  });
  it("updates all detected tools even if a stale caller submits a subset and a different target", async () => {
    tool("claude", "2.8.0");
    tool("cursor", "2.8.0");
    const opts = options();
    expect(
      await updateInstalledWorkflows({ ...opts, ...{ selected: ["claude"], pin: "9.0.0" } }),
    ).toMatchObject({ ok: true, target });
    const call = mocks.apply.mock.calls[0]?.[0];
    expect(call.pin).toBe(target);
    expect(new Set(call.selected)).toEqual(new Set(["claude", "cursor"]));
    expect(call.detected).toEqual(call.selected);
    expect(opts.setNeedsRepair.mock.calls).toEqual([[true], [false]]);
    expect(mocks.doctor).toHaveBeenCalledOnce();
    expect(opts.onHarnessResult).toHaveBeenCalledTimes(2);
  });
  it("preserves a failed update marker and permits retry even after every version was written", async () => {
    tool("claude", "2.8.0");
    tool("cursor", "2.8.0");
    mocks.apply.mockImplementationOnce(async () => {
      tool("claude", target);
      tool("cursor", target);
      pin(target);
      return { ok: false, target, reason: "cursor" };
    });
    const opts = options();
    expect((await updateInstalledWorkflows(opts)).ok).toBe(false);
    expect(opts.setNeedsRepair.mock.calls).toEqual([[true]]);
    expect(inspectWorkflowsManagement(root, true).canUpdate).toBe(true);
    expect((await updateInstalledWorkflows({ ...opts, needsRepair: true })).ok).toBe(true);
    expect(opts.setNeedsRepair).toHaveBeenLastCalledWith(false);
  });
  it("does not declare completion when files remain old or final doctor fails", async () => {
    tool("claude", "2.8.0");
    mocks.apply.mockResolvedValueOnce({ ok: true, target });
    const opts = options();
    expect(await updateInstalledWorkflows(opts)).toMatchObject({
      ok: false,
      reason: "verification",
    });
    expect(mocks.doctor).not.toHaveBeenCalled();
    mocks.doctor.mockResolvedValue({
      outcome: "failed",
      checks: [],
      summary: "失敗",
      unparsedOutput: [],
      rawOutput: "",
      counts: null,
    });
    expect(await updateInstalledWorkflows({ ...opts, needsRepair: true })).toMatchObject({
      ok: false,
      reason: "doctor",
    });
    expect(opts.setNeedsRepair).not.toHaveBeenCalledWith(false);
  });
  it("shares exclusion between installation and updates and releases after failures", async () => {
    tool("claude", "2.8.0");
    const release = acquireWorkflowsOperation(root);
    try {
      expect(await updateInstalledWorkflows(options())).toMatchObject({ reason: "busy" });
      expect(
        await installWorkflows({ workspaceRoot: root, selected: ["cursor"], log: vi.fn() }),
      ).toMatchObject({ reason: "busy" });
      expect(mocks.apply).not.toHaveBeenCalled();
    } finally {
      release?.();
    }
    mocks.apply.mockRejectedValueOnce(new Error("network"));
    expect((await updateInstalledWorkflows(options())).ok).toBe(false);
    expect((await updateInstalledWorkflows(options())).ok).toBe(true);
  });
  it("rejects newer versions and cancellation without entering the installer", async () => {
    tool("claude", "2.9.0");
    expect((await updateInstalledWorkflows(options())).ok).toBe(false);
    expect(await updateInstalledWorkflows({ ...options(), isCurrent: () => false })).toMatchObject({
      reason: "cancelled",
    });
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
