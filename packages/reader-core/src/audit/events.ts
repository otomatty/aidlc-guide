import { readdir } from "node:fs/promises";
import path from "node:path";
import { readBounded } from "@aidlc-guide/core-utils";
import type { AuditEvent, ReadResult } from "@aidlc-guide/shared-types";

/**
 * L3 — audit shard extraction. Shards are per-clone Markdown files whose
 * records are `---`-separated blocks of `**Field**: value` lines. Only the
 * fields the model needs are kept; bodies are never retained (BR-RC-6).
 * That now includes `Workflow` — see {@link AuditEvent.workflow}.
 */

export const AUDIT_DIRNAME = "audit";

const BLOCK_SEPARATOR = /^---\s*$/m;

function fieldOf(block: string, name: string): string | null {
  const match = new RegExp(`^\\*\\*${name}\\*\\*:\\s*(.+)$`, "m").exec(block);
  return match?.[1]?.trim() ?? null;
}

/**
 * Shared by this module's descending merge and `../timing/derive.ts`'s
 * ascending sort, so there is exactly one definition of "same instant" for
 * two events. The engine stamps a stage's STAGE_COMPLETED and the next
 * stage's STAGE_STARTED with the same second, and only append order (proxied
 * here by shard name) says which came first — if the two sort sites disagreed
 * on which pairs of events tie, they could silently invert that ordering. Time
 * is compared numerically (`Date.parse`), never by string equality, so an
 * offset or millisecond timestamp form still ties correctly.
 *
 * `Date.parse` returns `NaN` for a malformed timestamp, and `NaN` comparisons
 * are always false — a comparator that returns `NaN` is not a total order,
 * and `Array.prototype.sort` is free to leave unrelated well-formed events
 * out of order around it (regression, finding 1: this used to compare
 * timestamp *strings*, which never produced `NaN`). Every malformed
 * timestamp is partitioned to a fixed position — after every well-formed one
 * — in *both* comparators, independent of direction, so it can never sit
 * between two well-formed events and corrupt their relative order. Ties
 * within that partition (two malformed events, or two equal well-formed
 * ones) still fall back to the ascending shard-name tiebreak.
 */
function compareCore(a: AuditEvent, b: AuditEvent, direction: 1 | -1): number {
  const aTime = Date.parse(a.timestamp);
  const bTime = Date.parse(b.timestamp);
  const aValid = !Number.isNaN(aTime);
  const bValid = !Number.isNaN(bTime);
  if (aValid && bValid) {
    const delta = direction * (aTime - bTime);
    return delta !== 0 ? delta : a.shard.localeCompare(b.shard);
  }
  if (aValid !== bValid) return aValid ? -1 : 1; // malformed always sorts last
  return a.shard.localeCompare(b.shard); // both malformed
}

/** Ascending by parsed time, shard name as the always-ascending tiebreak. */
export function compareByTime(a: AuditEvent, b: AuditEvent): number {
  return compareCore(a, b, 1);
}

/** Descending by parsed time; the tiebreak stays ascending shard either way. */
function compareByTimeDescending(a: AuditEvent, b: AuditEvent): number {
  return compareCore(a, b, -1);
}

/**
 * Newest-first merge across shards, unbounded.
 *
 * A shard that cannot be read is skipped and reported in `warnings` — the
 * remaining shards still produce a usable timeline (failure mode 5 / BR-RC-5).
 */
export async function readAllAuditEvents(recordDir: string): Promise<ReadResult<AuditEvent[]>> {
  const dir = path.join(recordDir, AUDIT_DIRNAME);

  let shards: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    // Selected by name only, not by `isFile()`: anything occupying a shard name
    // that turns out not to be a readable file becomes a visible warning below
    // rather than a silent omission from the timeline.
    shards = entries
      .filter((e) => e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort(); // R-RC-5
  } catch {
    return { ok: true, value: [] }; // no audit dir = no events, not an error
  }

  const events: AuditEvent[] = [];
  const warnings: string[] = [];

  for (const shard of shards) {
    const read = await readBounded(path.join(dir, shard));
    if (!read.ok) {
      warnings.push(`audit shard skipped: ${shard} (${read.reason})`);
      continue;
    }
    for (const block of read.value.split(BLOCK_SEPARATOR)) {
      const event = fieldOf(block, "Event");
      const timestamp = fieldOf(block, "Timestamp");
      // The file header and any prose block carry neither — not a degradation,
      // just not a record.
      if (event === null || timestamp === null) continue;
      events.push({
        event,
        stage: fieldOf(block, "Stage"),
        timestamp,
        shard,
        workflow: fieldOf(block, "Workflow"),
      });
    }
  }

  // R-RC-5: timestamp descending, shard name ascending as the tiebreak, so the
  // same filesystem always yields the same order.
  events.sort(compareByTimeDescending);

  return warnings.length > 0 ? { ok: true, value: events, warnings } : { ok: true, value: events };
}

/** The bounded read every UI surface uses. `limit <= 0` yields an empty timeline. */
export async function readAuditEvents(
  recordDir: string,
  limit: number,
): Promise<ReadResult<AuditEvent[]>> {
  const all = await readAllAuditEvents(recordDir);
  if (!("ok" in all)) return all;
  const value = limit > 0 ? all.value.slice(0, limit) : [];
  return all.warnings === undefined
    ? { ok: true, value }
    : { ok: true, value, warnings: all.warnings };
}
