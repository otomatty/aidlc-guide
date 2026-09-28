import type { AuditEvent } from "@aidlc-guide/shared-types";

/**
 * The engine's attempt identity, re-derived at read time (issue #166). The
 * engine stamps Unit events with a `Run floor` naming the latest attempt
 * boundary for their stage — `latestMainWorkflowStageRunFloor` in
 * `.claude/tools/aidlc-lib.ts` — but never stamps one on STAGE_STARTED, so a
 * floor can only be judged against the floor the engine would have stamped
 * at that point in the stream, not against the run's own start.
 *
 * Which boundaries count depends on Construction settings in force when the
 * event was written. Rather than trusting today's state file for every past
 * event, a floor is current when it matches any rule the engine applies. A
 * floor naming an attempt that a later boundary superseded matches none of
 * them, which is the case readers must keep out. Unit-major rules ignore the
 * stage's own start, so once that stage has started again since the floor's
 * boundary, the floor no longer says which of those runs it belongs to: a
 * stage-major rerun could otherwise take an earlier attempt's floor as its own.
 */

const ATTEMPT_BOUNDARIES = new Set([
  "WORKFLOW_STARTED",
  "STAGE_JUMPED",
  "STAGE_STARTED",
  "GATE_REJECTED",
]);

interface FloorRule {
  /** Unit-major iteration or checkpoints: a stage's own start is no boundary. */
  unitMajor: boolean;
  /** Checkpoints or team ownership: another Unit's rejection is no boundary. */
  unit: string | undefined;
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

function counts(boundary: AuditEvent, stage: string, rule: FloorRule): boolean {
  if (boundary.event === "WORKFLOW_STARTED" || boundary.event === "STAGE_JUMPED") return true;
  if (boundary.event === "GATE_REJECTED") {
    if (!gateStages(boundary).includes(stage)) return false;
    const unit = boundary.fields?.Unit;
    return unit === undefined || unit === rule.unit;
  }
  return !rule.unitMajor && startsStage(boundary, stage);
}

/**
 * Ordinals count matching boundaries per event type, as the engine does.
 * `null` when the stage started more than once since the floor's boundary,
 * which only a rule that ignores those starts can produce.
 */
function floorOf(boundaries: readonly AuditEvent[], stage: string, rule: FloorRule): string | null {
  const ordinals = new Map<string, number>();
  let floor = "unstarted#0";
  let starts = 0;
  for (const boundary of boundaries) {
    if (!counts(boundary, stage, rule)) {
      if (startsStage(boundary, stage)) starts++;
      continue;
    }
    const ordinal = (ordinals.get(boundary.event) ?? 0) + 1;
    ordinals.set(boundary.event, ordinal);
    floor = `${boundary.event}:${boundary.timestamp}#${ordinal}`;
    starts = 0;
  }
  return starts > 1 ? null : floor;
}

/**
 * `events` is the sorted stream pairing produced; the returned check asks
 * whether the event at `index` belongs to the current attempt of `stage`. An
 * event with no floor makes no attempt claim and is accepted. The event's own
 * stage is checked too: a checkpoint gate carries its final stage's floor.
 */
export function runFloorCheck(
  events: readonly AuditEvent[],
): (event: AuditEvent, index: number, stage: string) => boolean {
  const boundaries = events.flatMap((event, index) =>
    ATTEMPT_BOUNDARIES.has(event.event) ? [{ event, index }] : [],
  );
  return (event, index, stage) => {
    const floor = event.fields?.["Run floor"];
    if (floor === undefined) return true;
    const before = boundaries.filter((item) => item.index < index).map((item) => item.event);
    const unit = event.fields?.Unit;
    const units = unit === undefined ? [undefined] : [undefined, unit];
    const rules = [false, true].flatMap((unitMajor) => units.map((u) => ({ unitMajor, unit: u })));
    const stages = new Set([stage, ...(event.stage ? [event.stage] : [])]);
    return [...stages].some((name) => rules.some((rule) => floorOf(before, name, rule) === floor));
  };
}
