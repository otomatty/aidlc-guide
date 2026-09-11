import { formatDuration, type IntentEffectiveness } from "@aidlc-guide/shared-types";

/** Existing timing UI rounds sub-minute durations; measured zero needs its own label here. */
export function formatEffectivenessDuration(value: number): string {
  return value === 0 ? "0分" : formatDuration(value);
}

/** Presentation totals only. Missing rows never contribute a measured zero. */
export function summarizeEffectiveness(rows: readonly IntentEffectiveness[]) {
  const completed = rows.flatMap((row) => (row.completionMs === null ? [] : [row.completionMs]));
  completed.sort((a, b) => a - b);
  const middle = Math.floor(completed.length / 2);
  const median =
    completed.length === 0
      ? null
      : completed.length % 2 === 0
        ? ((completed[middle - 1] ?? 0) + (completed[middle] ?? 0)) / 2
        : (completed[middle] ?? null);
  const waits = rows.flatMap((row) => (row.approvalWait === null ? [] : [row.approvalWait]));
  const closedWaits = waits.filter(
    (wait) => wait.completedIntervals > 0 && wait.completedMs !== null,
  );
  const openWaits = waits.filter((wait) => wait.pendingIntervals > 0 && wait.pendingMs !== null);
  const rejections = rows.flatMap((row) => (row.rejections === null ? [] : [row.rejections]));
  const reviews = rows.flatMap((row) => (row.reviews === null ? [] : [row.reviews]));
  const sensors = rows.flatMap((row) => (row.sensors === null ? [] : [row.sensors]));
  const usage = rows.flatMap((row) => (row.usage === null ? [] : [row.usage]));
  const priced = usage.flatMap((item) => (item.estimatedUsd === null ? [] : [item.estimatedUsd]));
  return {
    completed: { median, count: completed.length },
    waits: {
      count: closedWaits.length,
      pendingCount: openWaits.length,
      completedMs: closedWaits.reduce((sum, item) => sum + (item.completedMs ?? 0), 0),
      pendingMs: openWaits.reduce((sum, item) => sum + (item.pendingMs ?? 0), 0),
    },
    rejections: {
      count: rejections.length,
      total: rejections.reduce((sum, value) => sum + value, 0),
    },
    reviews: {
      count: reviews.filter((review) => review.firstPassTotal > 0).length,
      ready: reviews.reduce((sum, item) => sum + item.firstPassReady, 0),
      total: reviews.reduce((sum, item) => sum + item.firstPassTotal, 0),
    },
    sensors: {
      count: sensors.length,
      passed: sensors.reduce((sum, item) => sum + item.verifiedPassed, 0),
      failed: sensors.reduce((sum, item) => sum + item.failed, 0),
      incomplete: sensors.reduce((sum, item) => sum + item.incomplete, 0),
      skipped: sensors.reduce((sum, item) => sum + item.skipped, 0),
    },
    usage: {
      count: usage.length,
      priced: priced.length,
      usd: priced.length === 0 ? null : priced.reduce((sum, value) => sum + value, 0),
      partial: usage.some((item) => item.partial) || priced.length < usage.length,
    },
  };
}

export function formatRate(ready: number, total: number): string {
  return total === 0 ? "未記録" : `${Math.round((ready / total) * 100)}%`;
}

export function formatUsd(value: number | null): string {
  return value === null
    ? "算定不可"
    : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}
