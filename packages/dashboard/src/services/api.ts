import type {
  AgentDoc,
  DocsSettings,
  IntentList,
  MarkdownDoc,
  MarkdownItem,
  Matrix,
  ProjectLink,
  ReadResult,
  StageDoc,
  TimingsPayload,
  WorkflowPayload,
} from "@aidlc-guide/shared-types";
import type { Action, MatrixResponse } from "../store/reducer.ts";
import { getTransport } from "./transport/index.ts";

/**
 * The whole client surface. **GET only** — there is no POST helper in this
 * module and no other module issues requests, which is how S-UI-1 ("this unit
 * emits zero writes") is enforced structurally rather than by review.
 * `POST /api/answer` belongs to the artifact-viewer unit.
 */

/** Transport failure reason; joins the server's own StandardReason values. */
const UNREACHABLE = "server-unreachable";

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

async function getJson(path: string) {
  return await getTransport().getJson(path);
}

/** The one GET→ReadResult wrapper — every plain endpoint fetcher is this. */
async function getResult<T>(path: string): Promise<ReadResult<T>> {
  const fetched = await getJson(path);
  return fetched.reached ? asReadResult<T>(fetched.body) : unreachable();
}

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
  return await getResult<string>(`/api/artifact?path=${encodeURIComponent(path)}`);
}

const inFlight = new Map<string, Promise<ReadResult<string>>>();

export function prefetchArtifact(path: string): void {
  inFlight.set(path, readArtifact(path));
}

export async function fetchArtifact(path: string): Promise<ReadResult<string>> {
  const pending = inFlight.get(path);
  if (pending === undefined) return await readArtifact(path);
  inFlight.delete(path);
  return await pending;
}

export const fetchStageDoc = (slug: string): Promise<ReadResult<StageDoc>> =>
  getResult(`/api/stage/${encodeURIComponent(slug)}`);

export const fetchIntents = (): Promise<ReadResult<IntentList>> => getResult("/api/intents");

export const fetchLinks = (): Promise<ReadResult<ProjectLink[]>> => getResult("/api/links");

export const fetchDocsSettings = (): Promise<ReadResult<DocsSettings>> =>
  getResult("/api/docs-settings");

export const fetchTimings = (): Promise<ReadResult<TimingsPayload>> => getResult("/api/timings");

export const fetchGuides = (): Promise<ReadResult<MarkdownItem[]>> => getResult("/api/guides");

export const fetchGuide = (name: string): Promise<ReadResult<MarkdownDoc>> =>
  getResult(`/api/guides/${encodeURIComponent(name)}`);

export const fetchAgent = (id: string): Promise<ReadResult<AgentDoc>> =>
  getResult(`/api/agents/${encodeURIComponent(id)}`);

export const fetchAgentKnowledge = (
  agentId: string,
  name: string,
): Promise<ReadResult<MarkdownDoc>> =>
  getResult(`/api/agents/${encodeURIComponent(agentId)}/knowledge/${encodeURIComponent(name)}`);

export async function refetchAll(dispatch: (action: Action) => void): Promise<void> {
  const [workflow, matrix, intents] = await Promise.all([
    fetchWorkflow(),
    fetchMatrix(),
    fetchIntents(),
  ]);
  dispatch({ type: "workflow", result: workflow });
  dispatch({ type: "matrix", result: matrix });
  dispatch({ type: "intents", result: intents });
}
