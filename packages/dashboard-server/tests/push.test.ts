import { createHub, type PushClient } from "@aidlc-guide/api-core";
import type { AuditEvent, NextStep, WorkflowModel, WsMessage } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { ok, seedWorkspace, stubReader } from "./support.ts";

const WORKFLOW: WorkflowModel = {
  project: "p",
  scope: "feature",
  depth: "Standard",
  stateVersion: 7,
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

const NEXT_STEP: NextStep = { nextStage: "code-generation", requirement: "approve" };
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
    getNextStep: async () => ok(NEXT_STEP),
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
  it("state changes carry both workflow and nextStep (FR-4.6 live NextStepCallout)", async () => {
    const hub = createHub(deps());
    const client = recorder();
    hub.add(client);

    await hub.handleWatchEvent({ type: "change", scope: "state", path: "aidlc-state.md" });

    expect(client.messages[0]).toEqual({
      type: "change",
      scope: "state",
      workflow: WORKFLOW,
      nextStep: NEXT_STEP,
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

  it("degrades when nextStep alone is unreadable", async () => {
    const hub = createHub(
      deps({ getNextStep: async () => ({ error: true, reason: "state-unreadable" }) }),
    );
    const client = recorder();
    hub.add(client);
    await hub.handleWatchEvent({ type: "change", scope: "state", path: "s" });
    expect(client.messages[0]).toMatchObject({
      type: "live-status",
      reason: "next-step-unreadable",
    });
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
});
