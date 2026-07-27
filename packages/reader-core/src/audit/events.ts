import { readdir } from "node:fs/promises";
import path from "node:path";
import type { AuditEvent, ReadResult } from "@aidlc-guide/shared-types";
import { readBounded } from "../util/read-bounded.ts";

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
 */
function timeDelta(a: AuditEvent, b: AuditEvent): number {
  return Date.parse(a.timestamp) - Date.parse(b.timestamp);
}

/** Ascending by parsed time, shard name as the always-ascending tiebreak. */
export function compareByTime(a: AuditEvent, b: AuditEvent): number {
  const delta = timeDelta(a, b);
  return delta !== 0 ? delta : a.shard.localeCompare(b.shard);
}

/** Descending by parsed time; the tiebreak stays ascending shard either way. */
function compareByTimeDescending(a: AuditEvent, b: AuditEvent): number {
  const delta = timeDelta(a, b);
  return delta !== 0 ? -delta : a.shard.localeCompare(b.shard);
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
