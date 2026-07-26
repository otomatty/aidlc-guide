/** WS reconnect schedule (R-UI-4). Exported for tests. */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 10000] as const;

export function backoffFor(attempt: number): number {
  const capped = Math.min(attempt, BACKOFF_MS.length - 1);
  return BACKOFF_MS[capped] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 10_000;
}

export function wsUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
}
