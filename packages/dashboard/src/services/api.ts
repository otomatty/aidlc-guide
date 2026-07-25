import type {
  IntentList,
  Matrix,
  ProjectLink,
  ReadResult,
  StageDoc,
} from "@aidlc-guide/shared-types";
import type { Action, MatrixResponse } from "../store/reducer.ts";
import type { WorkflowPayload } from "../store/state.ts";

/**
 * The whole client surface. **GET only** — there is no POST helper in this
 * module and no other module issues requests, which is how S-UI-1 ("this unit
 * emits zero writes") is enforced structurally rather than by review.
 * `POST /api/answer` belongs to the artifact-viewer unit.
 */

/** Transport failure reason; joins the server's own StandardReason values. */
export const UNREACHABLE = "server-unreachable";

type Fetched = { reached: true; body: unknown } | { reached: false };

async function getJson(path: string): Promise<Fetched> {
  try {
    const response = await fetch(path, { headers: { accept: "application/json" } });
    return { reached: true, body: (await response.json()) as unknown };
  } catch {
    // Server down, or a body that is not JSON: both mean "cannot read", and
    // neither may reach the user as a blank screen (R-UI-3).
    return { reached: false };
  }
}

function unreachable<T>(): ReadResult<T> {
  return { error: true, reason: UNREACHABLE };
}

/** A `ReadResult` shape passed through verbatim by the server's `mapResult`. */
function asReadResult<T>(body: unknown): ReadResult<T> {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (record.ok === true || record.unsupported === true || record.error === true) {
      return body as ReadResult<T>;
    }
  }
  return { error: true, reason: "unexpected-response" };
}

/**
 * `/api/workflow` is the one endpoint that does *not* answer with a
 * ReadResult on success — it returns the payload bare — so it is lifted into
 * one here and the rest of the app sees a single shape.
 */
export async function fetchWorkflow(): Promise<ReadResult<WorkflowPayload>> {
  const fetched = await getJson("/api/workflow");
  if (!fetched.reached) return unreachable();
  const body = fetched.body;
  if (typeof body === "object" && body !== null && "workflow" in body) {
    const payload = body as WorkflowPayload;
    return payload.warnings === undefined
      ? { ok: true, value: payload }
      : { ok: true, value: payload, warnings: payload.warnings };
  }
  return asReadResult(body);
}

export async function fetchMatrix(): Promise<MatrixResponse> {
  const fetched = await getJson("/api/matrix");
  if (!fetched.reached) return unreachable<Matrix>();
  const body = fetched.body;
  if (typeof body === "object" && body !== null && "building" in body) return { building: true };
  return asReadResult<Matrix>(body);
}

async function readArtifact(path: string): Promise<ReadResult<string>> {
  const fetched = await getJson(`/api/artifact?path=${encodeURIComponent(path)}`);
  return fetched.reached ? asReadResult<string>(fetched.body) : unreachable();
}

/**
 * P-AV-2 hand-off. **Not a content cache**: an entry is a single-use baton, it
 * is dropped the instant it is read, and a second prefetch of the same path
 * always replaces it with a fresh request. Every open therefore issues exactly
 * one new read — which `viewer/services/answer.ts` depends on, since its
 * byte-invariance re-verification is only meaningful against a fresh re-read.
 *
 * Entries are deliberately *not* dropped when the request settles: a local
 * artifact read finishes well before a 50 kB chunk downloads, so a
 * settle-triggered delete would lose the hand-off in the common case and the
 * viewer would issue a second, duplicate request.
 *
 * ponytail: a prefetch that is never consumed (cell selected, viewer never
 * mounted) leaves one resolved string in the map until that path is prefetched
 * again. What is retained is the artifact *body*, not a promise handle, so the
 * ceiling is (distinct unconsumed paths × their file size), not a handle count;
 * add an expiry only if that ever shows up as memory.
 */
const inFlight = new Map<string, Promise<ReadResult<string>>>();

/**
 * Start the read now, so it runs alongside the viewer's chunk download instead
 * of after it (performance-design.md P-AV-2「開く操作の時点で両方開始」). The
 * viewer then calls {@link fetchArtifact} as usual and transparently picks up
 * this promise — D1's flow stays inside the viewer.
 */
export function prefetchArtifact(path: string): void {
  inFlight.set(path, readArtifact(path));
}

/**
 * One artifact's Markdown, by record-relative path. Read side of the
 * artifact-viewer unit; the write side (`POST /api/answer`) deliberately lives
 * in `viewer/services/answer.ts` so this module stays GET-only.
 */
export async function fetchArtifact(path: string): Promise<ReadResult<string>> {
  const pending = inFlight.get(path);
  if (pending === undefined) return await readArtifact(path);
  inFlight.delete(path);
  return await pending;
}

export async function fetchStageDoc(slug: string): Promise<ReadResult<StageDoc>> {
  const fetched = await getJson(`/api/stage/${encodeURIComponent(slug)}`);
  return fetched.reached ? asReadResult<StageDoc>(fetched.body) : unreachable();
}

/**
 * Enumeration only. There is no counterpart that *sets* the active intent —
 * the cursor is written by Claude Code, never by this app (S-UI-1 / NFR-1).
 */
export async function fetchIntents(): Promise<ReadResult<IntentList>> {
  const fetched = await getJson("/api/intents");
  return fetched.reached ? asReadResult<IntentList>(fetched.body) : unreachable();
}

export async function fetchLinks(): Promise<ReadResult<ProjectLink[]>> {
  const fetched = await getJson("/api/links");
  return fetched.reached ? asReadResult<ProjectLink[]>(fetched.body) : unreachable();
}

/**
 * Startup steps 1–3, re-run on every WS (re)connect. The server keeps no
 * per-client state, so a full re-read is the only way back to consistency
 * (R-UI-4 / dashboard-server R-DS-3). On-demand fetches (steps 6–7) are
 * deliberately *not* replayed: their data barely changes and they are off the
 * first-paint budget.
 */
export async function refetchAll(dispatch: (action: Action) => void): Promise<void> {
  // The intent list is one readdir, so it rides along with the two startup
  // reads rather than earning a step of its own.
  const [workflow, matrix, intents] = await Promise.all([
    fetchWorkflow(),
    fetchMatrix(),
    fetchIntents(),
  ]);
  dispatch({ type: "workflow", result: workflow });
  dispatch({ type: "matrix", result: matrix });
  dispatch({ type: "intents", result: intents });
}
