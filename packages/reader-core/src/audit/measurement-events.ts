/** Only measurement fields survive parsing. Prompts, feedback and document bodies do not. */
export const EFFECTIVENESS_FIELDS = new Set([
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
  "Source Fingerprint",
  "Request Source Fingerprint",
  "Unit Source Fingerprint",
  "Request Id",
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
  "Entries Merged",
  "Source Audit Hash",
  "Fork Boundary",
  "Fork Timestamp",
]);

export interface MeasurementEvent {
  event: string;
  timestamp: string;
  time: number;
  shard: string;
  position: number;
  fields: Record<string, string>;
}

export function parseMeasurementBlocks(
  text: string,
  shard: string,
  allowedFields: ReadonlySet<string> = EFFECTIVENESS_FIELDS,
): {
  events: MeasurementEvent[];
  warnings: string[];
} {
  const events: MeasurementEvent[] = [];
  const warnings: string[] = [];
  for (const [position, block] of text
    .split(/^---\s*$/m)
    .filter((part) => part.trim())
    .entries()) {
    const fields: Record<string, string> = Object.create(null);
    let invalid = false;
    for (const match of block.matchAll(/^\*\*([^*\r\n]+)\*\*:[ \t]*([^\r\n]*)$/gm)) {
      const name = match[1] ?? "";
      if (!allowedFields.has(name)) continue;
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

/** Timing deliberately does not expose review, usage, prompt or feedback data. */
export const TIMING_FIELDS = new Set([
  "Event",
  "Timestamp",
  "Stage",
  "Stage slug",
  "Workflow",
  "Unit",
  "Attempt Generation",
  "Run floor",
  "Gate Scope",
  "Gate Stages",
  "Recovered",
  "Revalidated",
  "Session",
  "Target",
  "Bolt slug",
  "Bolt names",
]);
