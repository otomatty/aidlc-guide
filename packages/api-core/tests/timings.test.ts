import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { routeRead } from "../src/handlers/read.ts";
import { createGuideService } from "../src/service.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function route(pathname: string) {
  return new URL(`http://localhost${pathname}`);
}

describe("GET /api/timings", () => {
  it("returns the active record's runs and a remaining estimate", async () => {
    const service = createGuideService({ workspaceRoot: REPO_ROOT });
    const result = await routeRead(service.readContext, route("/api/timings"));

    expect(result?.status).toBe(200);
    const body = result?.body as { ok: true; value: { timings: unknown[]; remaining: unknown } };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.value.timings)).toBe(true);
    expect(body.value.timings.length).toBeGreaterThanOrEqual(21);
    expect(body.value.remaining).toHaveProperty("pendingStages");
    expect(body.value.remaining).toHaveProperty("lowConfidence");
  });

  it("is not part of the workflow payload (ADR-03 段階的初回描画)", async () => {
    const service = createGuideService({ workspaceRoot: REPO_ROOT });
    const result = await routeRead(service.readContext, route("/api/workflow"));
    expect(result?.body).not.toHaveProperty("timings");
  });
});
