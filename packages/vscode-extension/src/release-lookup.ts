import {
  decideUpdate,
  type LatestRelease,
  parseLatestRelease,
  RELEASE_FETCH_TIMEOUT_MS,
  RELEASES_LATEST_URL,
  UPDATE_USER_AGENT,
} from "./update-release.ts";

export type LookupLatestResult =
  | { ok: true; release: LatestRelease }
  | {
      ok: false;
      reason: "rate-limited" | "timeout" | "network" | "http" | "parse" | "missing-asset";
    };

export async function lookupLatestRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<LookupLatestResult> {
  let response: Response;
  try {
    response = await fetchImpl(RELEASES_LATEST_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": UPDATE_USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(RELEASE_FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut =
      typeof cause === "object" &&
      cause !== null &&
      "name" in cause &&
      (cause.name === "TimeoutError" || cause.name === "AbortError");
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  }
  if (response.status === 403 || response.status === 429) {
    return { ok: false, reason: "rate-limited" };
  }
  if (!response.ok) {
    return { ok: false, reason: "http" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "parse" };
  }
  const parsed = parseLatestRelease(body);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason === "missing-asset" ? "missing-asset" : "parse" };
  }
  return { ok: true, release: parsed.value };
}

export async function newerRelease(currentVersion: string): Promise<LatestRelease | undefined> {
  const latest = await lookupLatestRelease();
  if (!latest.ok) return undefined;
  const decision = decideUpdate(currentVersion, latest.release);
  return decision.kind === "available" ? decision.latest : undefined;
}

export async function confirmNewerRelease(
  currentVersion: string,
  confirm: (version: string) => Promise<boolean>,
  onNone?: () => Promise<void>,
): Promise<LatestRelease | undefined> {
  const release = await newerRelease(currentVersion);
  if (release === undefined) {
    await onNone?.();
    return undefined;
  }
  return (await confirm(release.version)) ? release : undefined;
}
