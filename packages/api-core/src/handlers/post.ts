import type { GuideService } from "../service.ts";
import { handleAnswer, routeAnswer } from "./answer-writer.ts";
import type { RouteResult } from "./read.ts";
import { handleSelectIntent, routeSelectIntent } from "./select-intent.ts";

/**
 * The POST surface, declared once.
 *
 * Both hosts accept the same two writes but reach them differently: the
 * dashboard server has a `Request`/`Response` pair, the VS Code session has a
 * parsed postMessage body. That is why each route carries **both** transports
 * here — a route added for one host without the other is not expressible, which
 * is the failure the two hand-maintained dispatch tables used to invite (the
 * `unknown-route` reason exists precisely because that skew is reachable).
 *
 * Each entry delegates to the handler that owns the route, so the two JSON
 * error shapes stay exactly where they were defined. This module routes; it
 * does not re-map.
 */

interface PostRoute {
  /** Transport-agnostic: body already parsed (VS Code postMessage). */
  route(service: GuideService, body: unknown): Promise<RouteResult>;
  /** HTTP: the handler parses the body and owns its own bad-JSON reply. */
  http(service: GuideService, request: Request): Promise<Response>;
}

/**
 * A `Map`, not an object literal: the key is a path string the VS Code webview
 * supplies, and the message boundary only checks that it *is* a string. An
 * object lookup answers `"toString"` or `"constructor"` with the inherited
 * `Object.prototype` member, so dispatch would throw instead of returning
 * unknown-route — and the webview would sit waiting for a reply that never
 * comes. A Map has no prototype chain to inherit from.
 */
const POST_ROUTES: ReadonlyMap<string, PostRoute> = new Map([
  [
    "/api/answer",
    {
      route: async (service, body) => await routeAnswer(service.answerContext, body),
      http: async (service, request) => await handleAnswer(service.answerContext, request),
    } satisfies PostRoute,
  ],
  [
    "/api/select-intent",
    {
      route: routeSelectIntent,
      http: handleSelectIntent,
    } satisfies PostRoute,
  ],
]);

/** Paths this surface accepts, for callers that need to advertise them. */
export const POST_ROUTE_PATHS: readonly string[] = Object.freeze([...POST_ROUTES.keys()]);

/**
 * Transport-agnostic POST routing — the postMessage twin of {@link routeRead}.
 * `null` when no POST route owns the path; the caller decides what that means
 * on its transport (404 unknown-route, or 405 method-not-allowed).
 */
export async function routePost(
  service: GuideService,
  route: string,
  body: unknown,
): Promise<RouteResult | null> {
  const entry = POST_ROUTES.get(route);
  return entry === undefined ? null : await entry.route(service, body);
}

/** HTTP POST routing — the twin of {@link handleRead}. `null` when unrouted. */
export async function handlePost(
  service: GuideService,
  route: string,
  request: Request,
): Promise<Response | null> {
  const entry = POST_ROUTES.get(route);
  return entry === undefined ? null : await entry.http(service, request);
}
