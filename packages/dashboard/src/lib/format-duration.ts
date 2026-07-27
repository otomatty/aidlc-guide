/**
 * ms → `2h10m` / `45m` / `<1m` / `—`.
 *
 * `<1m` rather than `0m`: a stage that has just started has not taken zero
 * time, and "0m" reads as a broken measurement.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}
