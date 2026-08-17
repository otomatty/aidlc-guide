import { isVsixBuffer, UPDATE_USER_AGENT, VSIX_FETCH_TIMEOUT_MS } from "./update-release.ts";

export type ApplyReleaseResult =
  | { ok: true }
  | { ok: false; reason: "timeout" | "network" | "http" | "invalid-vsix" | "write" | "install" };

export type ApplyReleaseDeps = {
  fetchImpl: typeof fetch;
  writeBytes: (version: string, bytes: Uint8Array) => Promise<string>;
  installFromPath: (filePath: string) => Promise<void>;
  cleanupPath: (filePath: string) => Promise<void>;
};

let applyJob: Promise<ApplyReleaseResult> | undefined;

export async function applyReleaseFromUrl(
  version: string,
  url: string,
  deps: ApplyReleaseDeps,
): Promise<ApplyReleaseResult> {
  if (applyJob !== undefined) return applyJob;
  applyJob = applyReleaseFromUrlOnce(version, url, deps).finally(() => {
    applyJob = undefined;
  });
  return applyJob;
}

async function applyReleaseFromUrlOnce(
  version: string,
  url: string,
  deps: ApplyReleaseDeps,
): Promise<ApplyReleaseResult> {
  let response: Response;
  try {
    response = await deps.fetchImpl(url, {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": UPDATE_USER_AGENT,
      },
      signal: AbortSignal.timeout(VSIX_FETCH_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut =
      typeof cause === "object" &&
      cause !== null &&
      "name" in cause &&
      (cause.name === "TimeoutError" || cause.name === "AbortError");
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  }
  if (!response.ok) {
    return { ok: false, reason: "http" };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return { ok: false, reason: "network" };
  }
  if (!isVsixBuffer(bytes)) {
    return { ok: false, reason: "invalid-vsix" };
  }
  let filePath: string;
  try {
    filePath = await deps.writeBytes(version, bytes);
  } catch {
    return { ok: false, reason: "write" };
  }
  try {
    await deps.installFromPath(filePath);
    return { ok: true };
  } catch {
    return { ok: false, reason: "install" };
  } finally {
    await deps.cleanupPath(filePath);
  }
}
