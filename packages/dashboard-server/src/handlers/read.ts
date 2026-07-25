import type { Bridge } from "@aidlc-guide/docs-bridge";
import { guardPath, type Reader } from "@aidlc-guide/reader-core";
import type { Matrix, ReadResult, ServerMode } from "@aidlc-guide/shared-types";

/**
 * The seven GET handlers plus {@link mapResult} — the single ReadResult→HTTP
 * mapping (R-DS-1). No handler writes its own mapping.
 */

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

/**
 * The ReadResult *is* the payload: passing it through verbatim keeps warnings
 * and the `unsupported`/`error` discriminants intact, so the client reuses the
 * same union it already has from shared-types. Only the status varies.
 */
export function mapResult<T>(result: ReadResult<T>): Response {
  if ("ok" in result || "unsupported" in result) return json(result);
  return json(result, STATUS_BY_REASON[result.reason] ?? 200);
}

export interface ReadContext {
  reader: Reader;
  bridge: Bridge;
  /** `--host` is running; the client uses this to hide the editing UI. */
  hostMode: boolean;
  recordDir(): Promise<ReadResult<string>>;
  /** `null` until the background scan finishes (stage 2 of startup). */
  matrix(): ReadResult<Matrix> | null;
}

const STAGE_ROUTE = /^\/api\/stage\/(.+)$/;
const GLOSSARY_ROUTE = /^\/api\/glossary\/(.+)$/;

/**
 * Stage 1 of first paint: one state parse, no full scan (P-DS-1). Deliberately
 * carries **no** `matrix` key — the matrix arrives later over `/api/matrix` and
 * the `matrix-ready` push (ADR-03 段階的初回描画).
 */
async function workflow(ctx: ReadContext): Promise<Response> {
  const [state, nextStep] = await Promise.all([ctx.reader.getWorkflow(), ctx.reader.getNextStep()]);
  if (!("ok" in state)) return mapResult(state);
  if (!("ok" in nextStep)) return mapResult(nextStep);
  const serverMode: ServerMode = { hostMode: ctx.hostMode };
  return json({
    workflow: state.value,
    nextStep: nextStep.value,
    serverMode,
    ...(state.warnings === undefined ? {} : { warnings: state.warnings }),
  });
}

/**
 * Second check point on this path. `reader.readArtifact` guards internally too;
 * that duplication is deliberate defence in depth (S-DS-4) — unlike
 * `/api/answer`, which never goes through the reader and so has exactly one.
 */
async function artifact(ctx: ReadContext, url: URL): Promise<Response> {
  const rel = url.searchParams.get("path");
  if (rel === null) return json({ error: true, reason: "missing-path" }, 400);
  const record = await ctx.recordDir();
  if (!("ok" in record)) return mapResult(record);
  const guarded = await guardPath(record.value, rel);
  if (!("ok" in guarded)) return mapResult(guarded);
  return mapResult(await ctx.reader.readArtifact(rel));
}

/** `null` when the path is not an API route — the caller falls back to static. */
export async function handleRead(ctx: ReadContext, url: URL): Promise<Response | null> {
  const route = url.pathname;

  if (route === "/api/workflow") return await workflow(ctx);
  if (route === "/api/matrix") {
    const built = ctx.matrix();
    return built === null ? json({ building: true }) : mapResult(built);
  }
  if (route === "/api/artifact") return await artifact(ctx, url);
  // US-15 一覧導線: enumeration only. There is no route that *sets* the
  // active-intent cursor — switching stays a Claude Code command (NFR-1).
  if (route === "/api/intents") return mapResult(await ctx.reader.getIntents());
  if (route === "/api/links") return mapResult(await ctx.bridge.projectLinks());

  const stage = STAGE_ROUTE.exec(route);
  if (stage?.[1] !== undefined) {
    return mapResult(await ctx.bridge.resolveStage(decodeURIComponent(stage[1])));
  }

  const term = GLOSSARY_ROUTE.exec(route);
  if (term?.[1] !== undefined) {
    return mapResult(await ctx.bridge.resolveTerm(decodeURIComponent(term[1])));
  }

  // Any other /api/* path is a client bug, not an SPA route: answering it with
  // index.html would hand the caller HTML where it expects JSON.
  if (route.startsWith("/api/")) return json({ error: true, reason: "unknown-route" }, 404);
  return null;
}
