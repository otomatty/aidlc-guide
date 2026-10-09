import type { AuditEvent } from "@aidlc-guide/shared-types";
import { timeOf } from "../audit/events.ts";
import { stageJumpReaches } from "../audit/stage-jump.ts";

/**
 * The engine's attempt identity, re-derived at read time (issue #166). The
 * engine stamps Unit events with a `Run floor` naming the latest attempt
 * boundary for their stage — aidlc-workflows v2.11.0 aidlc-lib.ts
 * `latestMainWorkflowStageRunFloorFromRows`, through
 * `latestMainWorkflowStageRunFloorForProject` and, for Unit lifecycle
 * receipts, `unitLifecycleRunFloorForProject` — but never stamps one on
 * STAGE_STARTED, so a floor can only be judged against the floor the engine
 * would have stamped at that point in the stream, not against the run's own
 * start.
 *
 * Which boundaries count depends on Construction settings in force when the
 * event was written. Rather than trusting today's state file for every past
 * event, a floor is current when it matches any rule the engine applies. A
 * floor naming an attempt that a later boundary superseded matches none of
 * them, which is the case readers must keep out. Unit-major rules ignore the
 * stage's own start unless a CONSTRUCTION_POLICY_SET row shows it was recorded
 * under stage-major flooring, so once that stage has started again since the
 * floor's boundary without such a row, the floor no longer says which of those
 * runs it belongs to: a stage-major rerun could otherwise take an earlier
 * attempt's floor as its own.
 */

const ATTEMPT_BOUNDARIES = new Set([
  "WORKFLOW_STARTED",
  "STAGE_JUMPED",
  "STAGE_STARTED",
  "GATE_REJECTED",
]);
// v2.11.0 UNIT_LIFECYCLE_EVENTS: the receipts `unitLifecycleRunFloorForProject` floors.
const UNIT_LIFECYCLE_EVENTS = new Set([
  "UNIT_STARTED",
  "UNIT_PAUSED",
  "UNIT_RESUMED",
  "UNIT_COMPLETED",
  "UNIT_SKIPPED",
]);
const POLICY_FIELDS = new Set([
  "Construction Iteration",
  "Construction Checkpoints",
  "Construction Execution",
]);

interface FloorRule {
  /** Unit-major iteration or checkpoints: a stage's own start is no boundary. */
  unitMajor: boolean;
  /** Checkpoints or team ownership: another Unit's rejection is no boundary. */
  unit: string | undefined;
  /** A Unit lifecycle receipt under stage-major flooring. */
  unitReceipts: boolean;
}

/** Stage starts the CONSTRUCTION_POLICY_SET rows place, for one stream prefix. */
interface PolicyFloors {
  /** v2.11.0 `stageStartsUnderStageFlooring`. */
  stageFloored: Set<AuditEvent>;
  /** v2.11.0 `stageStartsUnderUnitFlooring`. */
  unitFloored: Set<AuditEvent>;
  /** Starts a later recorded change dates, so no rule is guessed for them. */
  dated: Set<AuditEvent>;
}

/** `Gate Stages` when present, otherwise the event's own stage. */
function gateStages(event: AuditEvent): string[] {
  const explicit = (event.fields?.["Gate Stages"] ?? "")
    .split(",")
    .map((stage) => stage.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;
  return event.stage ? [event.stage] : [];
}

/** A main-workflow start of this stage; isolated single-stage runs never count. */
function startsStage(boundary: AuditEvent, stage: string): boolean {
  return (
    boundary.event === "STAGE_STARTED" &&
    boundary.stage === stage &&
    !boundary.workflow?.startsWith("single-stage:")
  );
}

/** v2.11.0 `attemptEventDefinitelyBefore`: append order in a shard, time across shards. */
function definitelyBefore(earlier: AuditEvent, later: AuditEvent): boolean {
  if (earlier.shard === later.shard) return (earlier.position ?? 0) < (later.position ?? 0);
  return timeOf(earlier) < timeOf(later);
}

/** v2.11.0 `constructionPolicyRowComplete`: a row the typed setters wrote in full. */
function policyRowComplete(row: AuditEvent): boolean {
  const field = row.fields?.Field;
  return (
    row.event === "CONSTRUCTION_POLICY_SET" &&
    field !== undefined &&
    POLICY_FIELDS.has(field) &&
    !!row.fields?.Value &&
    !!row.fields?.["Previous Value"] &&
    !!row.fields?.["Construction Iteration"] &&
    !!row.fields?.["Construction Checkpoints"]
  );
}

/** v2.11.0 `constructionPolicyFoundUnitMajor`: the flooring in force before the change. */
function foundUnitMajor(row: AuditEvent): boolean {
  const before = (field: string): string | undefined =>
    row.fields?.Field === field ? row.fields?.["Previous Value"] : row.fields?.[field];
  return (
    before("Construction Iteration") === "unit-major" ||
    before("Construction Checkpoints") === "enabled"
  );
}

/**
 * The changes that may be the first one after `start`. The shared causal
 * order is not transitive, so when no change is plainly first, every change
 * that may follow the start counts.
 */
function changesAfter(start: AuditEvent, changes: readonly AuditEvent[]): AuditEvent[] {
  const after = changes.filter((change) => !definitelyBefore(change, start));
  const firstAfter = after.filter(
    (change) =>
      !after.some((other) => definitelyBefore(start, other) && definitelyBefore(other, change)),
  );
  return firstAfter.length > 0 ? firstAfter : after;
}

function policyFloors(rows: readonly AuditEvent[], order: readonly string[] | null): PolicyFloors {
  const stageFloored = new Set<AuditEvent>();
  const unitFloored = new Set<AuditEvent>();
  const dated = new Set<AuditEvent>();
  const changes = rows.filter(policyRowComplete);
  if (changes.length === 0) return { stageFloored, unitFloored, dated };
  const starts = rows.filter((row) => row.event === "STAGE_STARTED");
  for (const start of starts) {
    const candidates = changesAfter(start, changes);
    if (candidates.length === 0) continue;
    dated.add(start);
    // stageStartsUnderStageFlooring: counts unless every candidate found unit-major.
    if (candidates.some((change) => !foundUnitMajor(change))) stageFloored.add(start);
    // stageStartsUnderUnitFlooring: left out only when plainly before them all.
    if (candidates.every((change) => definitelyBefore(start, change) && foundUnitMajor(change)))
      unitFloored.add(start);
  }
  // A unit-major walk finishes a later stage's Units before that stage's first
  // STAGE_STARTED; that first start in its attempt, after a change that found
  // unit-major flooring and after Unit rows of the stage, is not a restart.
  const unitRows = rows.filter((row) => UNIT_LIFECYCLE_EVENTS.has(row.event));
  const boundaries = rows.filter(
    (row) => row.event === "WORKFLOW_STARTED" || row.event === "STAGE_JUMPED",
  );
  for (const start of starts) {
    if (unitFloored.has(start)) continue;
    const slug = start.stage;
    if (!slug || start.workflow?.startsWith("single-stage:")) continue;
    const opened = (row: AuditEvent): boolean =>
      definitelyBefore(row, start) &&
      !boundaries.some(
        (boundary) =>
          (boundary.event === "WORKFLOW_STARTED" ||
            stageJumpReaches(boundary.fields?.Target, slug, order)) &&
          definitelyBefore(row, boundary) &&
          definitelyBefore(boundary, start),
      );
    const first = !starts.some(
      (other) => other !== start && startsStage(other, slug) && opened(other),
    );
    if (
      first &&
      changes.some((change) => definitelyBefore(change, start) && foundUnitMajor(change)) &&
      unitRows.some((row) => row.stage === slug && opened(row))
    )
      unitFloored.add(start);
  }
  return { stageFloored, unitFloored, dated };
}

/**
 * v2.11.0 `latestMainWorkflowStageRunFloorFromRows`. A STAGE_STARTED keeps its
 * place among all of this stage's main-workflow starts and a STAGE_JUMPED its
 * place among all jumps, so neither token changes with the rule that counts it.
 * `null` when the stage started more than once since the floor's boundary
 * without a policy row dating those starts, which only a rule that ignores
 * them can produce.
 */
function floorOf(
  rows: readonly AuditEvent[],
  stage: string,
  rule: FloorRule,
  policy: PolicyFloors,
  order: readonly string[] | null,
): string | null {
  const startOrdinals = new Map<AuditEvent, number>();
  const jumpOrdinals = new Map<AuditEvent, number>();
  for (const row of rows) {
    if (startsStage(row, stage)) startOrdinals.set(row, startOrdinals.size + 1);
    if (row.event === "STAGE_JUMPED") jumpOrdinals.set(row, jumpOrdinals.size + 1);
  }
  const ordinals = new Map<string, number>();
  let floor = "unstarted#0";
  let starts = 0;
  for (const row of rows) {
    if (!ATTEMPT_BOUNDARIES.has(row.event)) continue;
    let counts: boolean;
    if (row.event === "WORKFLOW_STARTED") counts = true;
    else if (row.event === "STAGE_JUMPED")
      counts = stageJumpReaches(row.fields?.Target, stage, order);
    else if (row.event === "GATE_REJECTED") {
      const unit = row.fields?.Unit;
      counts = gateStages(row).includes(stage) && (unit === undefined || unit === rule.unit);
    } else {
      if (!startsStage(row, stage)) continue;
      counts = rule.unitMajor
        ? policy.stageFloored.has(row)
        : !(rule.unitReceipts && policy.unitFloored.has(row));
      if (!counts) {
        // A start only a unit-major rule leaves out, with no recorded change
        // dating it, is the one this reader cannot place.
        if (rule.unitMajor && !policy.dated.has(row)) starts++;
        continue;
      }
    }
    if (!counts) continue;
    const ordinal =
      row.event === "STAGE_STARTED"
        ? (startOrdinals.get(row) ?? 0)
        : row.event === "STAGE_JUMPED"
          ? (jumpOrdinals.get(row) ?? 0)
          : (ordinals.get(row.event) ?? 0) + 1;
    ordinals.set(row.event, ordinal);
    floor = `${row.event}:${row.timestamp}#${ordinal}`;
    starts = 0;
  }
  return starts > 1 ? null : floor;
}

/**
 * `events` is the sorted stream pairing produced; the returned check asks
 * whether the event at `index` belongs to the current attempt of `stage`. An
 * event with no floor makes no attempt claim and is accepted. The event's own
 * stage is checked too: a checkpoint gate carries its final stage's floor.
 * `stageOrder` is the stage-graph order a jump's reach is judged against
 * (`stageOrderOf`); without it every jump reaches every stage.
 */
export function runFloorCheck(
  events: readonly AuditEvent[],
  stageOrder: readonly string[] | null = null,
): (event: AuditEvent, index: number, stage: string) => boolean {
  // Policy placement depends only on the rows before an event; reuse it for
  // every event that saw the same rows.
  const relevant = events.flatMap((event, index) =>
    ATTEMPT_BOUNDARIES.has(event.event) ||
    UNIT_LIFECYCLE_EVENTS.has(event.event) ||
    event.event === "CONSTRUCTION_POLICY_SET"
      ? [index]
      : [],
  );
  const cache = new Map<number, PolicyFloors>();
  const prefix = (index: number) => {
    const count = relevant.filter((at) => at < index).length;
    const rows = relevant.slice(0, count).map((at) => events[at] as AuditEvent);
    let policy = cache.get(count);
    if (policy === undefined) {
      policy = policyFloors(rows, stageOrder);
      cache.set(count, policy);
    }
    return { rows, policy };
  };
  return (event, index, stage) => {
    const floor = event.fields?.["Run floor"];
    if (floor === undefined) return true;
    const { rows, policy } = prefix(index);
    const unit = event.fields?.Unit;
    const units = unit === undefined ? [undefined] : [undefined, unit];
    // Unit lifecycle receipts carry `unitLifecycleRunFloorForProject`; every
    // other floor is `latestMainWorkflowStageRunFloorForProject`.
    const receipts = UNIT_LIFECYCLE_EVENTS.has(event.event);
    const rules: FloorRule[] = [false, true].flatMap((unitMajor) =>
      units.map((u) => ({ unitMajor, unit: u, unitReceipts: receipts && !unitMajor })),
    );
    const stages = new Set([stage, ...(event.stage ? [event.stage] : [])]);
    return [...stages].some((name) =>
      rules.some((rule) => floorOf(rows, name, rule, policy, stageOrder) === floor),
    );
  };
}
