/** Only measurement fields survive parsing. Prompts, feedback and document bodies do not. */
const FIELDS = new Set([
  "Event",
  "Timestamp",
  "Stage",
  "Stage slug",
  "Workflow",
  "Unit",
  "Attempt Generation",
  "Recovered",
  "Revalidated",
  "Reviewer",
  "Iteration",
  "Verdict",
  "Artifact Fingerprint",
  "Request Fingerprint",
  "Fire id",
  "Sensor ID",
  "Note",
  "Findings count",
  "Tokens In",
  "Tokens Out",
  "Cache Read",
  "Cache Write",
  "Cost USD",
  "By Model",
  "Tokens By Model",
  "Gate Scope",
  "Gate Stages",
  "Target",
  "Bolt slug",
  "Bolt names",
  "Failed Bolt",
  "Retry",
  "Upgrade",
]);

export interface MeasurementEvent {
  event: string;
  timestamp: string;
  time: number;
  shard: string;
  position: number;
  fields: Record<string, string>;
}

export function parseMeasurementEvents(
  text: string,
  shard: string,
): {
  events: MeasurementEvent[];
  warnings: string[];
} {
  const events: MeasurementEvent[] = [];
  const warnings: string[] = [];
  for (const [position, block] of text.split(/^---\s*$/m).entries()) {
    const fields: Record<string, string> = Object.create(null);
    let invalid = false;
    for (const match of block.matchAll(/^\*\*([^*\r\n]+)\*\*:[ \t]*([^\r\n]*)$/gm)) {
      const name = match[1] ?? "";
      if (!FIELDS.has(name)) continue;
      const value = (match[2] ?? "").trim();
      if (Object.hasOwn(fields, name)) {
        if (fields[name] === value) continue;
        warnings.push(`conflicting audit field: ${shard} (${name})`);
        invalid = true;
        continue;
      }
      if (value.length > (name.includes("Model") ? 8192 : 512)) {
        invalid = true;
        continue;
      }
      fields[name] = value;
    }
    if (!fields.Event && !fields.Timestamp) continue;
    const time = Date.parse(fields.Timestamp ?? "");
    if (invalid || !fields.Event || !fields.Timestamp || !Number.isFinite(time)) {
      warnings.push(`malformed audit blocks ignored: ${shard}`);
      continue;
    }
    // Isolated workflow progress is excluded. Quality checks measure the entire
    // intent record, including isolated writes whose legacy sensors have no Workflow.
    if (fields.Workflow?.startsWith("single-stage:") && !fields.Event.startsWith("SENSOR_"))
      continue;
    // Legacy HUMAN_TURN receipts also cover isolated invocations and Q&A. Session or
    // timestamp proximity cannot prove their workflow, so require explicit attribution.
    if (fields.Event === "HUMAN_TURN" && !fields.Workflow) {
      warnings.push("human turns without workflow attribution excluded");
      continue;
    }
    events.push({
      event: fields.Event,
      timestamp: fields.Timestamp,
      time,
      shard,
      position,
      fields,
    });
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
