import path from "node:path";
import { mapBounded } from "@aidlc-guide/core-utils";
import type { ReadResult, StageTiming } from "@aidlc-guide/shared-types";
import { readAllAuditEvents } from "../audit/events.ts";
import { intentsDirOf, resolveIntents } from "../intents/resolve.ts";
import { deriveStageTimings } from "./derive.ts";

/** L4 — intent enumeration and sample collection. Never throws (BR-RC-2). */

/** At most this many intents read at once (each fans out over its own shards). */
const INTENT_READ_CONCURRENCY = 4;

function withWarnings(
  value: StageTiming[],
  warnings: readonly string[],
): ReadResult<StageTiming[]> {
  return warnings.length > 0 ? { ok: true, value, warnings: [...warnings] } : { ok: true, value };
}

export async function getStageTimings(
  recordDir: string,
  now: number,
): Promise<ReadResult<StageTiming[]>> {
  const events = await readAllAuditEvents(recordDir);
  if (!("ok" in events)) return events;
  const { timings, warnings } = deriveStageTimings(events.value, now);
  return withWarnings(timings, [...(events.warnings ?? []), ...warnings]);
}

/**
 * Every intent in the active space, concatenated — the sample pool an estimate
 * draws on. An intent that cannot be read is a warning, not a failure: a
 * partial pool still estimates (BR-RC-5).
 */
export async function getStageTimingSamples(
  rootPath: string,
  now: number,
): Promise<ReadResult<StageTiming[]>> {
  const intents = await resolveIntents(rootPath);
  if (!("ok" in intents)) return intents;

  const dir = intentsDirOf(rootPath, intents.value.space);
  const samples: StageTiming[] = [];
  const warnings: string[] = [];

  // Intents are independent records: read them concurrently — bounded, since
  // each read itself fans out over that record's audit shards — then assemble
  // in the enumeration order so the pool stays deterministic (R-RC-5). This
  // runs per change push and from two 30s pollers, so the serialization would
  // be paid constantly; the bound keeps worst-case file handles at
  // INTENT_READ_CONCURRENCY × shard concurrency.
  const reads = await mapBounded(intents.value.all, INTENT_READ_CONCURRENCY, (name) =>
    getStageTimings(path.join(dir, name), now),
  );
  for (const [index, read] of reads.entries()) {
    const name = intents.value.all[index] as string;
    if (!("ok" in read)) {
      warnings.push(`intent skipped: ${name}`);
      continue;
    }
    samples.push(...read.value);
    for (const warning of read.warnings ?? []) warnings.push(`${name}: ${warning}`);
  }

  return withWarnings(samples, warnings);
}
