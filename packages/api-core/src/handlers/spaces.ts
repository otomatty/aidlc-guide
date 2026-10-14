import type { GuideService } from "../service.ts";
import { acceptsCustomizationOrigin, readCustomizationBody } from "./local-request.ts";
import { json, type RouteResult } from "./read.ts";

export function routeSwitchSpace(service: GuideService, body: unknown): Promise<RouteResult> {
  return service.switchSpace(body);
}

export async function handleSwitchSpace(
  service: GuideService,
  request: Request,
): Promise<Response> {
  if (!acceptsCustomizationOrigin(request))
    return json({ error: true, reason: "origin-refused" }, 403);
  let body: unknown;
  try {
    body = await readCustomizationBody(request, 4096);
  } catch {
    return json({ error: true, reason: "bad-request" }, 400);
  }
  const result = await routeSwitchSpace(service, body);
  return json(result.body, result.status);
}
