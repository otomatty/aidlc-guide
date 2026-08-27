import type { GuideService } from "../service.ts";
import { json, type RouteResult } from "./read.ts";

function badRequest(): RouteResult {
  return { status: 400, body: { error: true, reason: "bad-request" } };
}

/**
 * `POST /api/select-intent` — mutates the in-memory view pin only.
 * Does not write `aidlc/` (NFR-1).
 */
export async function routeSelectIntent(
  service: GuideService,
  body: unknown,
): Promise<RouteResult> {
  if (typeof body !== "object" || body === null) return badRequest();
  const intent = (body as { intent?: unknown }).intent;
  if (typeof intent !== "string") return badRequest();
  return await service.selectIntent(intent);
}

export async function handleSelectIntent(
  service: GuideService,
  request: Request,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: true, reason: "bad-request" }, 400);
  }
  const result = await routeSelectIntent(service, body);
  return json(result.body, result.status);
}
