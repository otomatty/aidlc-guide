import { type MeasurementEvent, parseMeasurementBlocks } from "../audit/measurement-events.ts";

export type { MeasurementEvent } from "../audit/measurement-events.ts";

/** Effectiveness keeps its existing event exclusions separate from syntax parsing. */
export function parseMeasurementEvents(
  text: string,
  shard: string,
): {
  events: MeasurementEvent[];
  warnings: string[];
} {
  const parsed = parseMeasurementBlocks(text, shard);
  const warnings = [...parsed.warnings];
  const events: MeasurementEvent[] = [];
  for (const event of parsed.events) {
    const fields = event.fields;
    // Isolated workflow progress is excluded. Quality checks measure the entire
    // intent record, including isolated writes whose legacy sensors have no Workflow.
    if (fields.Workflow?.startsWith("single-stage:") && !event.event.startsWith("SENSOR_"))
      continue;
    // Legacy HUMAN_TURN receipts also cover isolated invocations and Q&A. Session or
    // timestamp proximity cannot prove their workflow, so require explicit attribution.
    if (fields.Event === "HUMAN_TURN" && !fields.Workflow) {
      warnings.push("human turns without workflow attribution excluded");
      continue;
    }
    events.push(event);
  }
  return { events, warnings: [...new Set(warnings)] };
}

export function sortMeasurementEvents(events: MeasurementEvent[]): MeasurementEvent[] {
  return events.sort(
    (a, b) => a.time - b.time || a.shard.localeCompare(b.shard) || a.position - b.position,
  );
}

/** A filename cannot establish causality for resets or gate resolutions across clones. */
export function hasAmbiguousLifecycleOrder(events: readonly MeasurementEvent[]): boolean {
  const boundaries = new Set([
    "WORKFLOW_STARTED",
    "WORKFLOW_COMPLETED",
    "STAGE_JUMPED",
    "BOLT_STARTED",
    "STAGE_STARTED",
    "STAGE_SKIPPED",
    "GATE_REJECTED",
    "GATE_APPROVED",
  ]);
  for (let start = 0; start < events.length; ) {
    const first = events[start];
    if (!first) break;
    let end = start + 1;
    while (end < events.length && events[end]?.time === first.time) end++;
    const group = events.slice(start, end);
    if (
      group.some((event) => event.shard !== first.shard) &&
      group.some((event) => boundaries.has(event.event))
    )
      return true;
    start = end;
  }
  return false;
}
