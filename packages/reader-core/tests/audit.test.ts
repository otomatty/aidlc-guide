import { describe, expect, it } from "vitest";
import { readAllAuditEvents, readAuditEvents } from "../src/audit/events.ts";
import { expectOk, fixture, REAL_RECORD } from "./paths.ts";

const RECORD = fixture("record");

describe("readAuditEvents", () => {
  it("merges shards newest first, breaking ties on shard name (R-RC-5)", async () => {
    const { value } = expectOk(await readAuditEvents(RECORD, 10));

    expect(value.map((e) => [e.event, e.shard])).toEqual([
      ["STAGE_COMPLETED", "aaa-clone.md"],
      ["GATE_OPENED", "bbb-clone.md"],
      ["STAGE_STARTED", "bbb-clone.md"],
      ["WORKFLOW_STARTED", "aaa-clone.md"],
    ]);
  });

  it("extracts only Event, Stage, Timestamp and Workflow — never the body (BR-RC-6)", async () => {
    const { value } = expectOk(await readAuditEvents(RECORD, 1));
    expect(value[0]).toEqual({
      event: "STAGE_COMPLETED",
      stage: "intent-capture",
      timestamp: "2026-07-20T12:00:00Z",
      shard: "aaa-clone.md",
      workflow: null,
    });
  });

  it("extracts the Workflow field when present, distinguishing an isolated single-stage run", async () => {
    const { value } = expectOk(await readAuditEvents(RECORD, 10));
    const withWorkflow = value.find((e) => e.event === "WORKFLOW_STARTED");
    expect(withWorkflow?.workflow).toBe("single-stage:demo-stage");
    // Every other fixture record carries no Workflow field at all.
    expect(value.find((e) => e.event === "STAGE_STARTED")?.workflow).toBeNull();
  });

  it("reports a null stage for records that carry no Stage field", async () => {
    const { value } = expectOk(await readAuditEvents(RECORD, 10));
    expect(value.find((e) => e.event === "WORKFLOW_STARTED")?.stage).toBeNull();
  });

  it("skips an unreadable shard with a warning and keeps the rest (mode 5)", async () => {
    const { warnings } = expectOk(await readAuditEvents(RECORD, 10));
    expect(warnings).toEqual(["audit shard skipped: unreadable-shard.md (not-a-file)"]);
  });

  it("honours the limit", async () => {
    expect(expectOk(await readAuditEvents(RECORD, 2)).value).toHaveLength(2);
    expect(expectOk(await readAuditEvents(RECORD, 0)).value).toEqual([]);
    expect(expectOk(await readAuditEvents(RECORD, -1)).value).toEqual([]);
  });

  it("returns an empty timeline when there is no audit directory", async () => {
    const result = expectOk(await readAuditEvents(fixture("golden"), 10));
    expect(result.value).toEqual([]);
    expect(result.warnings).toBeUndefined();
  });

  it("reads the live record's shards", async () => {
    const { value } = expectOk(await readAuditEvents(REAL_RECORD, 5));
    expect(value.length).toBeGreaterThan(0);
    expect(value.every((e) => e.timestamp.length > 0 && e.event.length > 0)).toBe(true);
    // Descending order holds across the real shard set.
    const timestamps = value.map((e) => e.timestamp);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });

  it("readAllAuditEvents returns every record with no limit applied", async () => {
    const { value } = expectOk(await readAllAuditEvents(RECORD));
    const limited = expectOk(await readAuditEvents(RECORD, 2)).value;
    expect(value).toHaveLength(4);
    expect(value.slice(0, 2)).toEqual(limited);
  });

  it("readAllAuditEvents carries the same shard warning as the limited read", async () => {
    const { warnings } = expectOk(await readAllAuditEvents(RECORD));
    expect(warnings).toEqual(["audit shard skipped: unreadable-shard.md (not-a-file)"]);
  });
});
