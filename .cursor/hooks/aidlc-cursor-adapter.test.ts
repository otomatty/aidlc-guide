import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveActiveRecordDir, workflowEnforcementActive } from "./aidlc-cursor-adapter.ts";

function seedRecord(
  root: string,
  slug: string,
  status: string | null,
  options: { cursor?: boolean; space?: string } = {},
): string {
  const space = options.space ?? "default";
  const intents = path.join(root, "aidlc", "spaces", space, "intents");
  const record = path.join(intents, slug);
  mkdirSync(record, { recursive: true });
  const statusLine = status === null ? "" : `- **Status**: ${status}\n`;
  writeFileSync(path.join(record, "aidlc-state.md"), `## Current Status\n${statusLine}`, "utf-8");
  if (options.cursor !== false) {
    writeFileSync(path.join(intents, "active-intent"), `${slug}\n`, "utf-8");
  }
  return record;
}

describe("workflowEnforcementActive", () => {
  it("is off when the workspace has no aidlc record", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-guard-none-"));
    expect(resolveActiveRecordDir(root)).toBeNull();
    expect(workflowEnforcementActive(root)).toBe(false);
  });

  it("is off when the active workflow is Completed", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-guard-done-"));
    seedRecord(root, "260720-done", "Completed");
    expect(workflowEnforcementActive(root)).toBe(false);
  });

  it("is on when the active workflow is Running", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-guard-run-"));
    seedRecord(root, "260720-run", "Running");
    expect(workflowEnforcementActive(root)).toBe(true);
  });

  it("is on when Status is missing (cannot tell it is finished)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-guard-unk-"));
    seedRecord(root, "260720-unk", null);
    expect(workflowEnforcementActive(root)).toBe(true);
  });

  it("uses the lone intent when the cursor is absent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-guard-lone-"));
    seedRecord(root, "260720-lone", "Running", { cursor: false });
    expect(path.basename(resolveActiveRecordDir(root) ?? "")).toBe("260720-lone");
    expect(workflowEnforcementActive(root)).toBe(true);
  });

  it("does not guess when two intents exist and the cursor is absent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aidlc-guard-two-"));
    seedRecord(root, "260720-a", "Running", { cursor: false });
    seedRecord(root, "260720-b", "Running", { cursor: false });
    expect(resolveActiveRecordDir(root)).toBeNull();
    expect(workflowEnforcementActive(root)).toBe(false);
  });
});
