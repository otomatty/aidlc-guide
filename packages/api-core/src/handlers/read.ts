import type { Bridge } from "@aidlc-guide/docs-bridge";
import { guardPath, nextStepOf, type Reader } from "@aidlc-guide/reader-core";
import type {
  DocsSettings,
  Matrix,
  ReadResult,
  ServerMode,
  WorkflowPayload,
} from "@aidlc-guide/shared-types";
import { readAgentKnowledge, resolveAgent } from "./agents.ts";
import { listGuides, readGuide } from "./guides.ts";
import { buildStageIoPaths } from "./io-paths.ts";

/**
 * The seven GET handlers plus {@link mapResult} — the single ReadResult→HTTP
 * mapping (R-DS-1). No handler writes its own mapping.
 */

export interface RouteResult {
  status: number;
  body: unknown;
}

/**
 * The one 404 sentinel for an unrecognised `/api/*` path — shared with the
 * VS Code postMessage transport so the wire shape is declared once.
 */
export const UNKNOWN_ROUTE: RouteResult = {
  status: 404,
  body: { error: true, reason: "unknown-route" },
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Only two reasons are entry-level enough to earn a non-200 status. Everything
 * else — including `unsupported`, `no-active-intent` and internal faults — is
 * 200 with the payload, because the UI has to *render* degradation rather than
 * treat it as a dead endpoint (BR-DS-4 / NFR-6 fail-soft).
 *
 * A 500 from this server therefore always means a server bug, never a
 * degraded workspace.
 */
const STATUS_BY_REASON: Readonly<Record<string, number>> = {
  "outside-record": 403,
  "artifact-not-found": 404,
};

export function statusForResult<T>(result: ReadResult<T>): number {
  if ("ok" in result || "unsupported" in result) return 200;
  return STATUS_BY_REASON[result.reason] ?? 200;
}

/**
 * The ReadResult *is* the payload: passing it through verbatim keeps warnings
 * and the `unsupported`/`error` discriminants intact, so the client reuses the
 * same union it already has from shared-types. Only the status varies.
 */
export function mapResult<T>(result: ReadResult<T>): Response {
  return json(result, statusForResult(result));
}

export function mapResultRoute<T>(result: ReadResult<T>): RouteResult {
  return { status: statusForResult(result), body: result };
}

export interface ReadContext {
  reader: Reader;
  bridge: Bridge;
  /** Workspace root — used for `docs/guides` and similar repo-local reads. */
  workspaceRoot: string;
  /** `--host` is running; the client uses this to hide the editing UI. */
  hostMode: boolean;
  recordDir(): Promise<ReadResult<string>>;
  /** `null` until the background scan finishes (stage 2 of startup). */
  matrix(): ReadResult<Matrix> | null;
}

const STAGE_ROUTE = /^\/api\/stage\/(.+)$/;
const GLOSSARY_ROUTE = /^\/api\/glossary\/(.+)$/;
const GUIDE_ROUTE = /^\/api\/guides\/(.+)$/;
const AGENT_KNOWLEDGE_ROUTE = /^\/api\/agents\/([^/]+)\/knowledge\/(.+)$/;
const AGENT_ROUTE = /^\/api\/agents\/([^/]+)$/;

/**
 * Stage 1 of first paint: one state parse, no full scan (P-DS-1). Deliberately
 * carries **no** `matrix` key — the matrix arrives later over `/api/matrix` and
 * the `matrix-ready` push (ADR-03 段階的初回描画).
 */
async function workflow(ctx: ReadContext): Promise<RouteResult> {
  // One read for both slices: `nextStepOf` derives from the same state parse,
  // so this path costs a single cursor-resolve + parse (P-DS-1).
  const state = await ctx.reader.getWorkflow();
  if (!("ok" in state)) return mapResultRoute(state);
  const serverMode: ServerMode = { hostMode: ctx.hostMode };
  const body: WorkflowPayload = {
    workflow: state.value,
    nextStep: nextStepOf(state.value),
    serverMode,
    ...(state.warnings === undefined ? {} : { warnings: state.warnings }),
  };
  return { status: 200, body };
}

/**
 * Second check point on this path. `reader.readArtifact` guards internally too;
 * that duplication is deliberate defence in depth (S-DS-4) — unlike
 * `/api/answer`, which never goes through the reader and so has exactly one.
 */
async function artifact(ctx: ReadContext, url: URL): Promise<RouteResult> {
  const rel = url.searchParams.get("path");
  if (rel === null) return { status: 400, body: { error: true, reason: "missing-path" } };
  const record = await ctx.recordDir();
  if (!("ok" in record)) return mapResultRoute(record);
  const guarded = await guardPath(record.value, rel);
  if (!("ok" in guarded)) return mapResultRoute(guarded);
  return mapResultRoute(await ctx.reader.readArtifact(rel));
}

/** Transport-agnostic GET routing — used by HTTP and VS Code postMessage. */
export async function routeRead(ctx: ReadContext, url: URL): Promise<RouteResult | null> {
  const route = url.pathname;

  if (route === "/api/workflow") return await workflow(ctx);
  // Deliberately its own route, not a key on /api/workflow: a full audit parse
  // must stay off the first-paint critical path (ADR-03 / NFR-2 3秒).
  if (route === "/api/timings") return mapResultRoute(await ctx.reader.getTimings());
  if (route === "/api/matrix") {
    const built = ctx.matrix();
    return built === null ? { status: 200, body: { building: true } } : mapResultRoute(built);
  }
  if (route === "/api/io-paths") {
    const stage = url.searchParams.get("stage");
    if (stage === null || stage.trim() === "") {
      return { status: 400, body: { error: true, reason: "missing-stage" } };
    }
    const unitParam = url.searchParams.get("unit");
    const unit = unitParam !== null && unitParam.trim() !== "" ? unitParam.trim() : null;
    const record = await ctx.recordDir();
    if (!("ok" in record)) return mapResultRoute(record);
    return mapResultRoute(await buildStageIoPaths(record.value, stage, unit));
  }
  if (route === "/api/artifact") return await artifact(ctx, url);
  if (route === "/api/intents") return mapResultRoute(await ctx.reader.getIntents());
  if (route === "/api/links") return mapResultRoute(await ctx.bridge.projectLinks());
  if (route === "/api/docs-settings") {
    const loaded = await ctx.bridge.getConfig();
    if (!("ok" in loaded)) return mapResultRoute(loaded);
    const settings: DocsSettings = {
      docsBaseUrl: loaded.value.docsBaseUrl,
      stageDocs: loaded.value.stageDocs,
    };
    return mapResultRoute({
      ok: true,
      value: settings,
      ...(loaded.warnings === undefined ? {} : { warnings: loaded.warnings }),
    });
  }
  if (route === "/api/guides") return mapResultRoute(await listGuides(ctx.workspaceRoot));

  const guide = GUIDE_ROUTE.exec(route);
  if (guide?.[1] !== undefined) {
    return mapResultRoute(await readGuide(ctx.workspaceRoot, decodeURIComponent(guide[1])));
  }

  const agentKnowledge = AGENT_KNOWLEDGE_ROUTE.exec(route);
  if (agentKnowledge?.[1] !== undefined && agentKnowledge[2] !== undefined) {
    return mapResultRoute(
      await readAgentKnowledge(
        ctx.workspaceRoot,
        decodeURIComponent(agentKnowledge[1]),
        decodeURIComponent(agentKnowledge[2]),
      ),
    );
  }

  const agent = AGENT_ROUTE.exec(route);
  if (agent?.[1] !== undefined) {
    return mapResultRoute(await resolveAgent(ctx.workspaceRoot, decodeURIComponent(agent[1])));
  }

  const stage = STAGE_ROUTE.exec(route);
  if (stage?.[1] !== undefined) {
    return mapResultRoute(await ctx.bridge.resolveStage(decodeURIComponent(stage[1])));
  }

  const term = GLOSSARY_ROUTE.exec(route);
  if (term?.[1] !== undefined) {
    return mapResultRoute(await ctx.bridge.resolveTerm(decodeURIComponent(term[1])));
  }

  if (route.startsWith("/api/")) return UNKNOWN_ROUTE;
  return null;
}

/** `null` when the path is not an API route — the caller falls back to static. */
export async function handleRead(ctx: ReadContext, url: URL): Promise<Response | null> {
  const result = await routeRead(ctx, url);
  if (result === null) return null;
  return json(result.body, result.status);
}
