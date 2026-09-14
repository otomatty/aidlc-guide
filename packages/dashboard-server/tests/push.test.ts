import { createHash } from "node:crypto";
import { createHub, type PushClient } from "@aidlc-guide/api-core";
import { buildMatrix, nextStepOf } from "@aidlc-guide/reader-core";
import type { AuditEvent, WorkflowModel, WsMessage } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { reviewAudit, reviewFixture } from "../../reader-core/tests/review-fixtures.ts";
import { ok, seedWorkspace, stubReader } from "./support.ts";

const WORKFLOW: WorkflowModel = {
  project: "p",
  scope: "feature",
  depth: "Standard",
  stateVersion: 8,
  schemaCompatibility: "current",
  phase: "CONSTRUCTION",
  currentStage: "functional-design",
  nextStage: "code-generation",
  gate: "awaiting-approval",
  stages: [
    { slug: "intent-capture", phase: "IDEATION", execution: "EXECUTE", status: "completed" },
    {
      slug: "functional-design",
      phase: "CONSTRUCTION",
      execution: "EXECUTE",
      status: "awaiting-approval",
    },
  ],
  done: 1,
  total: 2,
};

const EVENTS: AuditEvent[] = [
  {
    event: "GATE_OPENED",
    stage: "functional-design",
    timestamp: "2026-07-24T00:00:00Z",
    shard: "a",
    workflow: null,
  },
];

/** Records what a socket was told, without being a socket. */
function recorder(): PushClient & { messages: WsMessage[] } {
  const messages: WsMessage[] = [];
  return {
    messages,
    send(data) {
      messages.push(JSON.parse(data) as WsMessage);
    },
  };
}

const deps = (overrides = {}) => ({
  reader: stubReader({
    getWorkflow: async () => ok(WORKFLOW),
    getAuditEvents: async () => ok(EVENTS),
    ...overrides,
  }),
  recordDir: async () => ok(process.cwd()),
});

describe("hub fan-out (BR-DS-6)", () => {
  it("sends every connected client the identical payload", async () => {
    const hub = createHub(deps());
    const a = recorder();
    const b = recorder();
    hub.add(a);
    hub.add(b);

    await hub.handleWatchEvent({ type: "change", scope: "state", path: "aidlc-state.md" });

    expect(hub.size()).toBe(2);
    expect(a.messages).toHaveLength(1);
    // Byte-identical, not merely equivalent: the payload is serialised once.
    expect(JSON.stringify(a.messages)).toBe(JSON.stringify(b.messages));
  });

  it("stops sending to a removed client", async () => {
    const hub = createHub(deps());
    const a = recorder();
    hub.add(a);
    hub.remove(a);
    await hub.handleWatchEvent({ type: "change", scope: "state", path: "s" });
    expect(a.messages).toEqual([]);
  });

  it("a client that throws on send does not silence the others", async () => {
    const hub = createHub(deps());
    const broken: PushClient = {
      send() {
        throw new Error("socket closed");
      },
    };
    const healthy = recorder();
    hub.add(broken);
    hub.add(healthy);

    await hub.handleWatchEvent({ type: "change", scope: "state", path: "s" });

    expect(healthy.messages).toHaveLength(1);
    expect(hub.size()).toBe(1); // the broken one was dropped
  });
});

describe("watch → broadcast mapping", () => {
  it("clears a strict review verdict when a declared artifact changes after completion", async () => {
    const { root, recordDir } = await seedWorkspace();
    try {
      const graphFile = path.join(root, ".claude", "tools", "data", "stage-graph.json");
      await mkdir(path.dirname(graphFile), { recursive: true });
      await writeFile(
        graphFile,
        JSON.stringify([
          {
            slug: "functional-design",
            phase: "construction",
            for_each: "unit-of-work",
            produces: ["design"],
            review_artifact: "design",
          },
        ]),
      );
      const logical = "construction/unit-alpha/functional-design/design.md";
      const artifactFile = path.join(recordDir, logical);
      const body = "# Design\nReviewed design\n";
      await mkdir(path.dirname(artifactFile), { recursive: true });
      await writeFile(artifactFile, body);
      const sha = (value: string) => createHash("sha256").update(value).digest("hex");
      const fixture = reviewFixture({
        fingerprint: `sha256:${sha(JSON.stringify([[logical, `sha256:${sha(body)}`]]))}`,
      });
      const recordFile = path.join(recordDir, fixture.relative);
      await mkdir(path.dirname(recordFile), { recursive: true });
      await writeFile(recordFile, fixture.bytes);
      await mkdir(path.join(recordDir, "audit"));
      await writeFile(
        path.join(recordDir, "audit", "clone.md"),
        fixture.request + fixture.completion,
      );
      const hub = createHub({ ...deps(), recordDir: async () => ok(recordDir) });
      const client = recorder();
      hub.add(client);
      await hub.handleWatchEvent({
        type: "change",
        scope: "matrix:unit-alpha",
        path: artifactFile,
      });
      expect(client.messages.at(-1)).toMatchObject({
        scope: "matrix:unit-alpha",
        cells: [{ verdict: "READY" }],
      });

      await writeFile(artifactFile, "# Design\nChanged after review\n");
      await hub.handleWatchEvent({
        type: "change",
        scope: "matrix:unit-alpha",
        path: artifactFile,
      });
      expect(client.messages.at(-1)).toMatchObject({
        scope: "matrix:unit-alpha",
        cells: [{ verdict: null }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refreshes only reviewed units when the completion arrives after the review-file event", async () => {
    const { root, recordDir } = await seedWorkspace();
    try {
      await writeFile(
        path.join(recordDir, "aidlc-state.md"),
        "## Scope Configuration\n- **Change Control**: relaxed (set by you)\n",
      );
      const fixture = reviewFixture();
      const recordFile = path.join(recordDir, fixture.relative);
      const auditFile = path.join(recordDir, "audit", "clone.md");
      await mkdir(path.dirname(recordFile), { recursive: true });
      await mkdir(path.dirname(auditFile), { recursive: true });
      await writeFile(recordFile, fixture.bytes);
      await writeFile(auditFile, fixture.request);
      const hub = createHub({ ...deps(), recordDir: async () => ok(recordDir), auditLimit: 1 });
      const client = recorder();
      hub.add(client);
      await hub.handleWatchEvent({ type: "change", scope: "matrix:unit-alpha", path: recordFile });
      expect(client.messages[0]).toMatchObject({
        scope: "matrix:unit-alpha",
        cells: [{ verdict: null }],
      });

      // getAuditEvents returns only the timeline fields and may omit this
      // completion under its limit. Refresh derives units from the changed shard.
      await writeFile(auditFile, fixture.request + fixture.completion);
      await hub.handleWatchEvent({ type: "change", scope: "audit", path: auditFile });
      expect(client.messages.at(-1)).toMatchObject({
        scope: "matrix:unit-alpha",
        cells: [{ verdict: "READY" }],
      });

      const otherShard = path.join(recordDir, "audit", "reset.md");
      await writeFile(
        otherShard,
        reviewAudit("STAGE_STARTED", { Stage: "functional-design", "Attempt Generation": "2" }, 3),
      );
      await hub.handleWatchEvent({ type: "change", scope: "audit", path: otherShard });
      expect(client.messages.at(-1)).toMatchObject({
        scope: "matrix:unit-alpha",
        cells: [{ verdict: null }],
      });

      await writeFile(
        auditFile,
        fixture.request +
          fixture.completion +
          reviewAudit(
            "STAGE_STARTED",
            { Stage: "functional-design", "Attempt Generation": "2" },
            3,
          ),
      );
      await hub.handleWatchEvent({ type: "change", scope: "audit", path: auditFile });
      expect(client.messages.at(-1)).toMatchObject({
        scope: "matrix:unit-alpha",
        cells: [{ verdict: null }],
      });
      expect(
        client.messages
          .filter((message) => "scope" in message && message.scope.startsWith("matrix:"))
          .every((message) => "scope" in message && message.scope === "matrix:unit-alpha"),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refreshes every unit after a coalesced multi-shard audit burst", async () => {
    const { root, recordDir } = await seedWorkspace();
    try {
      await writeFile(
        path.join(recordDir, "aidlc-state.md"),
        "## Scope Configuration\n- **Change Control**: relaxed (set by you)\n",
      );
      await mkdir(path.join(recordDir, "audit"));
      for (const [index, unit] of ["unit-alpha", "unit-beta"].entries()) {
        const fixture = reviewFixture({ unit, id: index === 0 ? "a" : "b" });
        const recordFile = path.join(recordDir, fixture.relative);
        await mkdir(path.dirname(recordFile), { recursive: true });
        await mkdir(path.join(recordDir, "construction", unit, "functional-design"), {
          recursive: true,
        });
        await writeFile(recordFile, fixture.bytes);
        await writeFile(
          path.join(recordDir, "audit", `${unit}.md`),
          fixture.request + fixture.completion,
        );
      }
      const hub = createHub({
        ...deps({ getMatrix: () => buildMatrix(recordDir, ["functional-design"]) }),
        recordDir: async () => ok(recordDir),
      });
      const client = recorder();
      hub.add(client);
      await hub.handleWatchEvent({
        type: "change",
        scope: "audit",
        path: path.join(recordDir, "audit"),
      });
      expect(client.messages.slice(1)).toMatchObject([
        { scope: "matrix:unit-alpha", cells: [{ verdict: "READY" }] },
        { scope: "matrix:unit-beta", cells: [{ verdict: "READY" }] },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("state changes carry both workflow and nextStep (FR-4.6 live NextStepCallout)", async () => {
    const hub = createHub(deps());
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({ type: "change", scope: "state", path: "aidlc-state.md" });

    // nextStep derives from the same state read (nextStepOf) — one parse per push.
    expect(client.messages[0]).toEqual({
      type: "change",
      scope: "state",
      workflow: WORKFLOW,
      nextStep: nextStepOf(WORKFLOW),
    });
  });

  it("carries getWorkflow warnings on a state change (v7 browse notice)", async () => {
    const hub = createHub(
      deps({
        getWorkflow: async () => ({
          ok: true,
          value: WORKFLOW,
          warnings: ["State Version 7 browse"],
        }),
      }),
    );
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({ type: "change", scope: "state", path: "aidlc-state.md" });

    expect(client.messages[0]).toEqual({
      type: "change",
      scope: "state",
      workflow: WORKFLOW,
      nextStep: nextStepOf(WORKFLOW),
      warnings: ["State Version 7 browse"],
    });
  });

  it("audit changes carry the refreshed events", async () => {
    const hub = createHub(deps());
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({ type: "change", scope: "audit", path: "audit/a.md" });

    expect(client.messages[0]).toEqual({ type: "change", scope: "audit", events: EVENTS });
  });

  it("a matrix change rebuilds only the changed unit (BR-DS-5)", async () => {
    const { recordDir } = await seedWorkspace();
    const hub = createHub({ ...deps(), recordDir: async () => ok(recordDir) });
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({
      type: "change",
      scope: "matrix:unit-alpha",
      path: "construction/unit-alpha/x.md",
    });

    const message = client.messages[0];
    expect(message).toMatchObject({ type: "change", scope: "matrix:unit-alpha" });
    // Only the construction stages from the state file, only for this unit.
    expect(message).toHaveProperty("cells");
    const cells = (message as { cells: { unit: string }[] }).cells;
    expect(cells.every((c) => c.unit === "unit-alpha")).toBe(true);
  });

  it("a watch warning becomes live-status so the UI can stop claiming freshness", async () => {
    const hub = createHub(deps());
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({ type: "watch-warning", reason: "watcher-lost" });

    expect(client.messages[0]).toEqual({
      type: "live-status",
      degraded: true,
      reason: "watcher-lost",
    });
  });

  it("degrades rather than going quiet when a re-fetch fails", async () => {
    const hub = createHub(
      deps({ getWorkflow: async () => ({ error: true, reason: "state-unreadable" }) }),
    );
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({ type: "change", scope: "state", path: "s" });

    expect(client.messages[0]).toMatchObject({ type: "live-status", degraded: true });
  });

  it("degrades when the audit log cannot be re-read", async () => {
    const hub = createHub(
      deps({ getAuditEvents: async () => ({ error: true, reason: "state-unreadable" }) }),
    );
    const client = recorder();
    hub.add(client);
    await hub.handleWatchEvent({ type: "change", scope: "audit", path: "audit/a.md" });
    expect(client.messages[0]).toMatchObject({ type: "live-status", reason: "audit-unreadable" });
  });

  it("degrades a matrix change when no intent is active", async () => {
    const hub = createHub({
      ...deps(),
      recordDir: async () => ({ error: true, reason: "no-active-intent" }),
    });
    const client = recorder();
    hub.add(client);
    await hub.handleWatchEvent({ type: "change", scope: "matrix:u", path: "construction/u/a.md" });
    expect(client.messages[0]).toMatchObject({ type: "live-status", reason: "no-record" });
  });

  it("degrades a matrix change when the state file cannot supply the stage set", async () => {
    const hub = createHub(deps({ getWorkflow: async () => ({ unsupported: true, version: "6" }) }));
    const client = recorder();
    hub.add(client);
    await hub.handleWatchEvent({ type: "change", scope: "matrix:u", path: "construction/u/a.md" });
    expect(client.messages[0]).toMatchObject({
      type: "live-status",
      reason: "workflow-unreadable",
    });
  });

  it("ignores a scope it does not recognise instead of broadcasting noise", async () => {
    const hub = createHub(deps());
    const client = recorder();
    hub.add(client);
    await hub.handleWatchEvent({
      type: "change",
      scope: "unknown" as "state",
      path: "x",
    });
    expect(client.messages).toEqual([]);
  });

  it("drops a watch event that went stale while the record was being read", async () => {
    let current = true;
    const hub = createHub(
      deps({
        getWorkflow: async () => {
          current = false;
          return ok(WORKFLOW);
        },
      }),
    );
    const client = recorder();
    hub.add(client);
    await hub.handleWatchEvent({ type: "change", scope: "state", path: "s" }, () => current);
    expect(client.messages).toEqual([]);
  });
});

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
