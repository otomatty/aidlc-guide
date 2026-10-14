import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AuditEvent, StageInfo, UnitWalk } from "@aidlc-guide/shared-types";
import { afterEach, describe, expect, it } from "vitest";
import { deriveUnitWalk, parseUnitWalkOrder, readUnitWalk } from "../src/tree/unit-walk.ts";
import { stage, workflow } from "./timing-fixtures.ts";

const PER_UNIT = [
  "functional-design",
  "nfr-requirements",
  "nfr-design",
  "infrastructure-design",
  "code-generation",
];

function stages(over: Record<string, Partial<StageInfo>> = {}): StageInfo[] {
  return [
    stage("units-generation", { phase: "INCEPTION", status: "completed" }),
    ...PER_UNIT.map((slug) => stage(slug, over[slug])),
    stage("build-and-test", over["build-and-test"]),
  ];
}

let clock = 0;
/** One audit row; rows are timestamped in call order a second apart. */
function ev(event: string, fields: Record<string, string> = {}): AuditEvent {
  clock += 1;
  const timestamp = new Date(Date.UTC(2026, 9, 1, 0, 0, clock)).toISOString();
  return {
    event,
    stage: fields.Stage ?? null,
    timestamp,
    shard: "a.md",
    workflow: fields.Workflow ?? null,
    position: clock,
    fields: { Event: event, Timestamp: timestamp, ...fields },
  };
}

const unit = (name: string, stageSlug: string, event: string): AuditEvent =>
  ev(event, { Stage: stageSlug, Unit: name });

/** `unit` → its step statuses, in per-Unit stage order. */
function grid(walk: UnitWalk): Record<string, string[]> {
  return Object.fromEntries(walk.units.map((u) => [u.unit, u.steps.map((s) => s.status)]));
}

const NS = "not-started";
const IP = "in-progress";
const OK = "completed";
const SK = "skipped";

describe("parseUnitWalkOrder — the engine's walk order (aidlc-lib.ts parseBoltDag)", () => {
  const doc = (yaml: string) => `# Units\n\n\`\`\`mermaid\ngraph TD\n\`\`\`\n\n\`\`\`yaml\n${yaml}\n\`\`\`\n`;

  it("orders by dependency level, each level sorted by name", () => {
    const body = doc(
      [
        "units:",
        "  - name: web",
        "    kind: ui",
        "    depends_on: [api, auth]",
        "  - name: api",
        "    depends_on:",
        "      - auth",
        "  - name: auth",
        "    depends_on: []",
        "  - name: docs",
        "    depends_on: []",
      ].join("\n"),
    );
    expect(parseUnitWalkOrder(body)).toEqual(["auth", "docs", "api", "web"]);
  });

  it("reads quoted names and quoted inline dependencies", () => {
    const body = doc(
      ['units:', '  - name: "b"', '    depends_on: ["a"]', "  - name: 'a'", "    depends_on: []"].join(
        "\n",
      ),
    );
    expect(parseUnitWalkOrder(body)).toEqual(["a", "b"]);
  });

  it.each([
    ["no units block", "# Units\n\nprose only\n"],
    ["a cycle", doc("units:\n  - name: a\n    depends_on: [b]\n  - name: b\n    depends_on: [a]")],
    ["an unknown dependency", doc("units:\n  - name: a\n    depends_on: [ghost]")],
    ["a duplicate name", doc("units:\n  - name: a\n  - name: a")],
    ["an invalid name", doc("units:\n  - name: ../a")],
    ["an inline units value", doc("units: [a]")],
    ["an unknown line", doc("units:\n  - name: a\n    owner: me")],
    ["no entries", doc("units:\n")],
    ["a dependency on itself", doc("units:\n  - name: a\n    depends_on: [a]")],
    ["depends_on before a name", doc("units:\n    depends_on: []\n  - name: a")],
    ["names that differ only in case", doc("units:\n  - name: Api\n  - name: api")],
    ["an unknown kind", doc("units:\n  - name: a\n    kind: widget")],
  ])("refuses %s, as the engine does", (_label, body) => {
    expect(parseUnitWalkOrder(body)).toBeNull();
  });
});

describe("deriveUnitWalk — per-Unit progress from the Unit receipts", () => {
  it("folds start, complete and skip receipts per Unit and stage", () => {
    const events = [
      unit("u1", "functional-design", "UNIT_STARTED"),
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      unit("u1", "nfr-requirements", "UNIT_STARTED"),
      unit("u1", "nfr-requirements", "UNIT_COMPLETED"),
      unit("u1", "nfr-design", "UNIT_SKIPPED"),
      unit("u1", "infrastructure-design", "UNIT_STARTED"),
      unit("u1", "infrastructure-design", "UNIT_COMPLETED"),
      unit("u1", "code-generation", "UNIT_STARTED"),
      unit("u1", "code-generation", "UNIT_COMPLETED"),
      unit("u2", "functional-design", "UNIT_STARTED"),
      unit("u2", "functional-design", "UNIT_PAUSED"),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1", "u2", "u3"], events);
    expect(walk.stages).toEqual(PER_UNIT);
    expect(grid(walk)).toEqual({
      u1: [OK, OK, SK, OK, OK],
      u2: [IP, NS, NS, NS, NS],
      u3: [NS, NS, NS, NS, NS],
    });
    expect(walk.units.map((u) => u.status)).toEqual([OK, IP, NS]);
    expect(walk.byStage[0]).toEqual({
      stage: "functional-design",
      completed: 1,
      skipped: 0,
      total: 3,
    });
    expect(walk.byStage[2]).toEqual({ stage: "nfr-design", completed: 0, skipped: 1, total: 3 });
  });

  it("reads a stage a Unit passed without a receipt as not owed", () => {
    // A `spec` Unit owes nothing for nfr-design: the engine walks it straight on.
    const events = [
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      unit("u1", "code-generation", "UNIT_STARTED"),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], events);
    expect(grid(walk).u1).toEqual([OK, SK, SK, SK, IP]);
  });

  it("puts the state file's open Unit on its own step", () => {
    const walk = deriveUnitWalk(
      workflow({
        stages: stages(),
        activeUnit: { unit: "u2", stage: "nfr-design", state: "paused" },
      }),
      ["u1", "u2"],
      [unit("u2", "functional-design", "UNIT_COMPLETED"), unit("u2", "nfr-requirements", "UNIT_COMPLETED")],
    );
    expect(grid(walk).u2).toEqual([OK, OK, IP, NS, NS]);
  });

  it("ignores an open Unit outside the DAG or on a stage that is not per-Unit", () => {
    const base = workflow({ stages: stages() });
    for (const activeUnit of [
      { unit: "ghost", stage: "code-generation", state: "in-progress" as const },
      { unit: "u1", stage: "build-and-test", state: "in-progress" as const },
      { unit: "u1", stage: null, state: "in-progress" as const },
    ]) {
      const walk = deriveUnitWalk({ ...base, activeUnit }, ["u1"], []);
      expect(grid(walk).u1).toEqual([NS, NS, NS, NS, NS]);
    }
  });

  it("marks every Unit of a stage the workflow skips", () => {
    const walk = deriveUnitWalk(
      workflow({ stages: stages({ "infrastructure-design": { execution: "SKIP", status: "skipped" } }) }),
      ["u1", "u2"],
      [],
    );
    expect(grid(walk)).toEqual({ u1: [NS, NS, NS, SK, NS], u2: [NS, NS, NS, SK, NS] });
  });

  it("reads a finished stage without Unit receipts as done for every Unit", () => {
    // Records from before Unit receipts tick the stage box only.
    const walk = deriveUnitWalk(
      workflow({ stages: stages({ "functional-design": { status: "completed" } }) }),
      ["u1", "u2"],
      [],
    );
    expect(grid(walk)).toEqual({ u1: [OK, NS, NS, NS, NS], u2: [OK, NS, NS, NS, NS] });
    expect(walk.byStage[0]?.completed).toBe(2);
  });

  it("reopens the named Unit's steps on its reopen rejection", () => {
    const events = [
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      unit("u1", "nfr-requirements", "UNIT_COMPLETED"),
      unit("u2", "functional-design", "UNIT_COMPLETED"),
      ev("GATE_REJECTED", {
        Stage: "functional-design",
        Unit: "u1",
        "Gate Stages": "functional-design, nfr-requirements",
        "Gate Scope": "unit-end",
      }),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1", "u2"], events);
    expect(grid(walk)).toEqual({ u1: [NS, NS, NS, NS, NS], u2: [OK, NS, NS, NS, NS] });
  });

  it("resets every Unit from a jump's target on, and everything on a new workflow", () => {
    const done = PER_UNIT.map((slug) => unit("u1", slug, "UNIT_COMPLETED"));
    const order = stages();
    const jumped = deriveUnitWalk(workflow({ stages: order }), ["u1"], [
      ...done,
      ev("STAGE_JUMPED", { Target: "nfr-design" }),
    ]);
    expect(grid(jumped).u1).toEqual([OK, OK, NS, NS, NS]);
    const restarted = deriveUnitWalk(workflow({ stages: order }), ["u1"], [
      ...done,
      ev("WORKFLOW_STARTED"),
    ]);
    expect(grid(restarted).u1).toEqual([NS, NS, NS, NS, NS]);
  });

  it("keeps a Unit open after its checkpoint is rejected, and closes it on approval", () => {
    const done = PER_UNIT.map((slug) => unit("u1", slug, "UNIT_COMPLETED"));
    const checkpoint = (event: string) =>
      ev(event, { Stage: "code-generation", Unit: "u1", Checkpoint: "construction-unit" });
    const rejected = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], [
      ...done,
      checkpoint("GATE_REJECTED"),
    ]);
    expect(rejected.units[0]?.status).toBe(IP);
    expect(grid(rejected).u1).toEqual([OK, OK, OK, OK, OK]);
    const approved = deriveUnitWalk(workflow({ stages: stages() }), ["u1", "u2"], [
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      checkpoint("GATE_APPROVED"),
    ]);
    // The approved Unit owed none of the stages it has no receipt for.
    expect(grid(approved).u1).toEqual([OK, SK, SK, SK, SK]);
    expect(approved.units[0]?.status).toBe(OK);
  });

  it("keeps a reopened step open even though the Unit has later progress", () => {
    // aidlc-jump.ts reopens only the named steps; the Unit's later ones stand.
    const events = [
      ...PER_UNIT.map((slug) => unit("u1", slug, "UNIT_COMPLETED")),
      ev("GATE_APPROVED", { Stage: "code-generation", Unit: "u1", Checkpoint: "construction-unit" }),
      ev("GATE_REJECTED", {
        Stage: "functional-design",
        Unit: "u1",
        "Gate Stages": "functional-design",
        "Gate Scope": "unit-end",
      }),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], events);
    expect(grid(walk).u1).toEqual([NS, OK, OK, OK, OK]);
    expect(walk.units[0]?.status).toBe(IP);
    const redone = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], [
      ...events,
      unit("u1", "functional-design", "UNIT_COMPLETED"),
    ]);
    expect(grid(redone).u1).toEqual([OK, OK, OK, OK, OK]);
  });

  it("starts a stage over for every Unit when stage-major starts it again", () => {
    const events = [
      ev("STAGE_STARTED", { Stage: "functional-design" }),
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      ev("STAGE_STARTED", { Stage: "functional-design" }),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], events);
    expect(grid(walk).u1).toEqual([NS, NS, NS, NS, NS]);
  });

  it("keeps finished Units when a stage starts under unit-major", () => {
    // unit-major starts the later per-Unit stages only for their late gates.
    const events = [
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      unit("u1", "nfr-requirements", "UNIT_COMPLETED"),
      ev("STAGE_STARTED", { Stage: "nfr-requirements" }),
    ];
    const unitMajor = workflow({
      stages: stages(),
      constructionPolicy: {
        checkpoints: false,
        unitMajor: true,
        iterationRecorded: true,
        swarm: false,
        autonomous: false,
        teamOwnership: false,
        unitEndRhythm: false,
        skeletonStanceRecorded: false,
        skeletonMayRun: false,
      },
    });
    expect(grid(deriveUnitWalk(unitMajor, ["u1"], events)).u1).toEqual([OK, OK, NS, NS, NS]);
  });

  it("judges each stage start by the iteration in force when it was written", () => {
    // Recorded stage-major first, switched to unit-major, then started again.
    const policy = (from: string, to: string) =>
      ev("CONSTRUCTION_POLICY_SET", {
        Field: "Construction Iteration",
        Value: to,
        "Previous Value": from,
      });
    const events = [
      unit("u1", "functional-design", "UNIT_COMPLETED"),
      policy("stage-major", "unit-major"),
      ev("STAGE_STARTED", { Stage: "functional-design" }),
      unit("u2", "functional-design", "UNIT_COMPLETED"),
      policy("unit-major", "stage-major"),
      ev("STAGE_STARTED", { Stage: "nfr-requirements" }),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1", "u2"], events);
    expect(grid(walk).u1?.[0]).toBe(OK);
    expect(grid(walk).u2?.[0]).toBe(OK);
  });

  it("does not count a stage the workflow skips as a Unit's start", () => {
    const walk = deriveUnitWalk(
      workflow({ stages: stages({ "nfr-design": { execution: "SKIP", status: "skipped" } }) }),
      ["u1"],
      [],
    );
    expect(walk.units[0]?.status).toBe(NS);
  });

  it("reads a Unit owed nothing at all as skipped", () => {
    const skip = { execution: "SKIP" as const, status: "skipped" as const };
    const allSkipped = Object.fromEntries(PER_UNIT.map((slug) => [slug, skip]));
    const walk = deriveUnitWalk(workflow({ stages: stages(allSkipped) }), ["u1"], []);
    expect(walk.units[0]?.status).toBe(SK);
  });

  it("keeps the open Unit it was derived with, so a surface can pair them", () => {
    const activeUnit = { unit: "u1", stage: "nfr-design", state: "in-progress" as const };
    expect(deriveUnitWalk(workflow({ stages: stages(), activeUnit }), ["u1"], []).activeUnit).toEqual(
      activeUnit,
    );
    expect(deriveUnitWalk(workflow({ stages: stages() }), ["u1"], []).activeUnit).toBeNull();
  });

  it("orders receipts by time, not by array position", () => {
    const started = unit("u1", "functional-design", "UNIT_STARTED");
    const completed = unit("u1", "functional-design", "UNIT_COMPLETED");
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], [completed, started]);
    expect(grid(walk).u1?.[0]).toBe(OK);
  });

  it("ignores single-stage runs, Units outside the DAG and stages that are not per-Unit", () => {
    const events = [
      ev("UNIT_COMPLETED", {
        Stage: "functional-design",
        Unit: "u1",
        Workflow: "single-stage:functional-design",
      }),
      unit("ghost", "functional-design", "UNIT_COMPLETED"),
      unit("u1", "build-and-test", "UNIT_COMPLETED"),
      ev("UNIT_COMPLETED", { Unit: "u1" }),
    ];
    const walk = deriveUnitWalk(workflow({ stages: stages() }), ["u1"], events);
    expect(grid(walk)).toEqual({ u1: [NS, NS, NS, NS, NS] });
  });

  it("covers only the per-Unit stages this workflow has", () => {
    const only = [stage("functional-design"), stage("code-generation"), stage("build-and-test")];
    const walk = deriveUnitWalk(workflow({ stages: only }), ["u1"], []);
    expect(walk.stages).toEqual(["functional-design", "code-generation"]);
  });
});

describe("readUnitWalk — the record's Unit DAG", () => {
  let dir: string | null = null;
  afterEach(async () => {
    if (dir !== null) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  async function record(dag: string | null): Promise<string> {
    dir = await mkdtemp(path.join(tmpdir(), "unit-walk-"));
    if (dag !== null) {
      const at = path.join(dir, "inception", "units-generation");
      await mkdir(at, { recursive: true });
      await writeFile(path.join(at, "unit-of-work-dependency.md"), dag);
    }
    return dir;
  }

  const none = async () => ({ ok: true as const, value: [] });
  const DAG = "```yaml\nunits:\n  - name: b\n    depends_on: [a]\n  - name: a\n    depends_on: []\n```\n";

  it("walks the Units the DAG names, in its order", async () => {
    const walk = await readUnitWalk(await record(DAG), workflow({ stages: stages() }), none);
    expect(walk?.units.map((u) => u.unit)).toEqual(["a", "b"]);
  });

  it("is null without a DAG, with an unreadable one, or without per-Unit stages", async () => {
    expect(await readUnitWalk(await record(null), workflow({ stages: stages() }), none)).toBeNull();
    await rm(dir as string, { recursive: true, force: true });
    expect(
      await readUnitWalk(await record("no block"), workflow({ stages: stages() }), none),
    ).toBeNull();
    await rm(dir as string, { recursive: true, force: true });
    const noUnitStages = [stage("build-and-test")];
    expect(await readUnitWalk(await record(DAG), workflow({ stages: noUnitStages }), none)).toBeNull();
  });

  it("reads the audit log only for a record with a DAG, and shows nothing when it is unreadable", async () => {
    let reads = 0;
    const counted = async () => {
      reads += 1;
      return { ok: true as const, value: [] };
    };
    await readUnitWalk(await record(null), workflow({ stages: stages() }), counted);
    expect(reads).toBe(0);
    await rm(dir as string, { recursive: true, force: true });
    const unreadable = async () => ({ error: true as const, reason: "state-unreadable" as const });
    expect(await readUnitWalk(await record(DAG), workflow({ stages: stages() }), unreadable)).toBeNull();
  });
});
