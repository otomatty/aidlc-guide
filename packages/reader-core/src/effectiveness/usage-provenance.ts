import { type MeasurementEvent, sortMeasurementEvents } from "./events.ts";

export const UNKNOWN_USAGE_PROVENANCE = "worktree usage provenance unavailable";

function forkKey(event: MeasurementEvent): string | null {
  const slug = event.fields["Bolt slug"];
  const hash = event.fields["Source Audit Hash"];
  const boundary = event.fields["Fork Boundary"];
  if (!slug || !hash || !/^[0-9a-f]{64}$/.test(hash) || !boundary || !/^\d+$/.test(boundary))
    return null;
  if (!Number.isSafeInteger(Number(boundary))) return null;
  return JSON.stringify([slug, hash, Number(boundary), event.timestamp]);
}

/** Recover atomic merge ranges in append order, before using chronological usage snapshots. */
export function groupUsageByOrigin(
  events: readonly MeasurementEvent[],
): Map<string, MeasurementEvent[]> | null {
  const shards = new Map<string, MeasurementEvent[]>();
  for (const event of events) {
    const rows = shards.get(event.shard) ?? [];
    rows.push(event);
    shards.set(event.shard, rows);
  }
  const groups = new Map<string, MeasurementEvent[]>();
  for (const [shard, rows] of shards) {
    rows.sort((a, b) => a.position - b.position);
    const forks = new Map<string, MeasurementEvent>();
    const owners = new Map<MeasurementEvent, string>();
    // Claimed worktree shards start with the copied fork receipt. Both that copy
    // and the parent's merged delta use this identity, so they cannot be added twice.
    const first = rows[0];
    const copiedFork =
      first?.event === "AUDIT_FORKED" &&
      !rows.some((event) => ["AUDIT_MERGED", "WORKFLOW_COMPLETED"].includes(event.event))
        ? forkKey(first)
        : null;
    const clone = /-([a-z0-9]{1,32})\.md$/.exec(shard)?.[1] ?? shard;
    const defaultOwner = copiedFork ? `fork:${copiedFork}` : `clone:${clone}`;
    for (const [index, event] of rows.entries()) {
      if (event.event === "AUDIT_FORKED") {
        const key = forkKey(event);
        if (!key || (copiedFork && event !== first)) return null;
        forks.set(event.fields["Bolt slug"] as string, event);
        // An abandoned worktree without a usage receipt still makes coverage partial.
        if (!groups.has(`fork:${key}`)) groups.set(`fork:${key}`, []);
      }
      if (event.event !== "AUDIT_MERGED") continue;
      const fork = forks.get(event.fields["Bolt slug"] ?? "");
      const key = fork ? forkKey(fork) : null;
      const rawCount = event.fields["Entries Merged"] ?? "";
      const count = /^\d+$/.test(rawCount) ? Number(rawCount) : NaN;
      if (
        !fork ||
        !key ||
        !Number.isSafeInteger(count) ||
        event.position - count <= fork.position ||
        event.fields["Source Audit Hash"] !== fork.fields["Source Audit Hash"] ||
        event.fields["Fork Boundary"] !== fork.fields["Fork Boundary"] ||
        (event.fields["Fork Timestamp"] !== undefined &&
          event.fields["Fork Timestamp"] !== fork.timestamp)
      )
        return null;
      // The engine appends exactly these blocks plus AUDIT_MERGED atomically.
      // Other parent activity between fork and merge must retain its original owner.
      for (let i = index - 1; i >= 0; i--) {
        const entry = rows[i];
        if (!entry || entry.position < event.position - count) break;
        if (owners.has(entry) || /^(AUDIT_|WORKFLOW_)/.test(entry.event)) return null;
        owners.set(entry, `fork:${key}`);
      }
    }
    for (const event of rows) {
      const owner = owners.get(event) ?? defaultOwner;
      const group = groups.get(owner) ?? [];
      group.push(event);
      groups.set(owner, group);
    }
  }
  for (const [owner, rows] of groups) groups.set(owner, sortMeasurementEvents(rows));
  return groups;
}
