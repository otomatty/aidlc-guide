import { readdir } from "node:fs/promises";
import path from "node:path";
import type { AuditEvent, ReadResult } from "@aidlc-guide/shared-types";
import { readBounded } from "../util/read-bounded.ts";

/**
 * L3 — audit shard extraction. Shards are per-clone Markdown files whose
 * records are `---`-separated blocks of `**Field**: value` lines. Only the
 * three fields the model needs are kept; bodies are never retained (BR-RC-6).
 */

export const AUDIT_DIRNAME = "audit";

const BLOCK_SEPARATOR = /^---\s*$/m;

function fieldOf(block: string, name: string): string | null {
  const match = new RegExp(`^\\*\\*${name}\\*\\*:\\s*(.+)$`, "m").exec(block);
  return match?.[1]?.trim() ?? null;
}

/**
 * Newest-first merge across shards, capped at `limit`.
 *
 * A shard that cannot be read is skipped and reported in `warnings` — the
 * remaining shards still produce a usable timeline (failure mode 5 / BR-RC-5).
 */
export async function readAuditEvents(
  recordDir: string,
  limit: number,
): Promise<ReadResult<AuditEvent[]>> {
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
      events.push({ event, stage: fieldOf(block, "Stage"), timestamp, shard });
    }
  }

  // R-RC-5: timestamp descending, shard name ascending as the tiebreak, so the
  // same filesystem always yields the same order.
  events.sort((a, b) =>
    a.timestamp === b.timestamp
      ? a.shard.localeCompare(b.shard)
      : a.timestamp < b.timestamp
        ? 1
        : -1,
  );

  const value = limit > 0 ? events.slice(0, limit) : [];
  return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
}
