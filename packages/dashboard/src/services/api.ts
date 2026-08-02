import type {
  AgentDoc,
  DocsSettings,
  IntentList,
  MarkdownDoc,
  MarkdownItem,
  Matrix,
  OfficialDocsLocale,
  OfficialDocsManifest,
  OfficialDocsPage,
  OfficialDocsToc,
  ProjectLink,
  ReadResult,
  StageDoc,
  StageDocRef,
  StageIoPaths,
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

export function fetchIoPaths(
  stage: string,
  unit: string | null,
): Promise<ReadResult<StageIoPaths>> {
  const q = new URLSearchParams({ stage });
  if (unit !== null) q.set("unit", unit);
  return getResult(`/api/io-paths?${q}`);
}

export const fetchIntents = (): Promise<ReadResult<IntentList>> => getResult("/api/intents");

export const fetchLinks = (): Promise<ReadResult<ProjectLink[]>> => getResult("/api/links");

export const fetchDocsSettings = (): Promise<ReadResult<DocsSettings>> =>
  getResult("/api/docs-settings");

export const fetchTimings = (): Promise<ReadResult<TimingsPayload>> => getResult("/api/timings");

export const fetchGuides = (): Promise<ReadResult<MarkdownItem[]>> => getResult("/api/guides");

export const fetchGuide = (name: string): Promise<ReadResult<MarkdownDoc>> =>
  getResult(`/api/guides/${encodeURIComponent(name)}`);

/** Encode a DocPath (`guide/…`) so each segment stays a path segment on the wire. */
function encodeDocPath(docPath: string): string {
  return docPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export const fetchOfficialDocsManifest = (): Promise<ReadResult<OfficialDocsManifest>> =>
  getResult("/api/official-docs/manifest");

export const fetchOfficialDocsToc = (
  locale: OfficialDocsLocale,
): Promise<ReadResult<OfficialDocsToc>> =>
  getResult(`/api/official-docs/toc/${encodeURIComponent(locale)}`);

export function fetchOfficialDocsPage(
  locale: OfficialDocsLocale,
  docPath: string,
  anchor?: string,
): Promise<ReadResult<OfficialDocsPage>> {
  const base = `/api/official-docs/${encodeURIComponent(locale)}/${encodeDocPath(docPath)}`;
  if (anchor === undefined || anchor === "") return getResult(base);
  const q = new URLSearchParams({ anchor });
  return getResult(`${base}?${q}`);
}

/** `GET /api/official-docs/stage/:slug` — mapped StageDocRef or null (unmapped). */
export const fetchOfficialDocsStageMap = (slug: string): Promise<ReadResult<StageDocRef | null>> =>
  getResult(`/api/official-docs/stage/${encodeURIComponent(slug)}`);

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
