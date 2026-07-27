import type {
  AgentDoc,
  IntentList,
  Matrix,
  ProjectLink,
  ReadResult,
  StageDoc,
  TimingsPayload,
} from "@aidlc-guide/shared-types";
import type { Action, MatrixResponse } from "../store/reducer.ts";
import type { WorkflowPayload } from "../store/state.ts";
import { getTransport } from "./transport/index.ts";

/**
 * The whole client surface. **GET only** — there is no POST helper in this
 * module and no other module issues requests, which is how S-UI-1 ("this unit
 * emits zero writes") is enforced structurally rather than by review.
 * `POST /api/answer` belongs to the artifact-viewer unit.
 */

/** Transport failure reason; joins the server's own StandardReason values. */
export const UNREACHABLE = "server-unreachable";

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

export async function fetchStageDoc(slug: string): Promise<ReadResult<StageDoc>> {
  const fetched = await getJson(`/api/stage/${encodeURIComponent(slug)}`);
  return fetched.reached ? asReadResult<StageDoc>(fetched.body) : unreachable();
}

export async function fetchIntents(): Promise<ReadResult<IntentList>> {
  const fetched = await getJson("/api/intents");
  return fetched.reached ? asReadResult<IntentList>(fetched.body) : unreachable();
}

export async function fetchLinks(): Promise<ReadResult<ProjectLink[]>> {
  const fetched = await getJson("/api/links");
  return fetched.reached ? asReadResult<ProjectLink[]>(fetched.body) : unreachable();
}

export interface DocsSettings {
  docsBaseUrl: string | null;
  stageDocs: Readonly<Record<string, string>>;
}

export async function fetchDocsSettings(): Promise<ReadResult<DocsSettings>> {
  const fetched = await getJson("/api/docs-settings");
  return fetched.reached ? asReadResult<DocsSettings>(fetched.body) : unreachable();
}

export async function fetchTimings(): Promise<ReadResult<TimingsPayload>> {
  const fetched = await getJson("/api/timings");
  return fetched.reached ? asReadResult<TimingsPayload>(fetched.body) : unreachable();
}

export interface GuideInfo {
  name: string;
  title: string;
}

export interface GuideDoc {
  name: string;
  title: string;
  markdown: string;
}

export async function fetchGuides(): Promise<ReadResult<GuideInfo[]>> {
  const fetched = await getJson("/api/guides");
  return fetched.reached ? asReadResult<GuideInfo[]>(fetched.body) : unreachable();
}

export async function fetchGuide(name: string): Promise<ReadResult<GuideDoc>> {
  const fetched = await getJson(`/api/guides/${encodeURIComponent(name)}`);
  return fetched.reached ? asReadResult<GuideDoc>(fetched.body) : unreachable();
}

export interface AgentKnowledgeDoc {
  name: string;
  title: string;
  markdown: string;
}

export async function fetchAgent(id: string): Promise<ReadResult<AgentDoc>> {
  const fetched = await getJson(`/api/agents/${encodeURIComponent(id)}`);
  return fetched.reached ? asReadResult<AgentDoc>(fetched.body) : unreachable();
}

export async function fetchAgentKnowledge(
  agentId: string,
  name: string,
): Promise<ReadResult<AgentKnowledgeDoc>> {
  const fetched = await getJson(
    `/api/agents/${encodeURIComponent(agentId)}/knowledge/${encodeURIComponent(name)}`,
  );
  return fetched.reached ? asReadResult<AgentKnowledgeDoc>(fetched.body) : unreachable();
}

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
