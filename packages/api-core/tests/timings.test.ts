import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RemainingEstimate, StageTiming } from "@aidlc-guide/shared-types";
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
    const body = result?.body as {
      ok: true;
      value: { timings: StageTiming[]; remaining: RemainingEstimate };
    };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.value.timings)).toBe(true);
    expect(body.value.timings.length).toBeGreaterThanOrEqual(21);

    // This repository's own workspace is at its terminal state (last stage
    // completed, nothing pending) — pin the actual values, not just presence
    // of the keys, so a regression like findings 1/2 (phantom elapsed/
    // remaining on a finished current stage) fails this test.
    const { remaining } = body.value;
    expect(remaining.pendingStages).toEqual([]);
    expect(remaining.currentStage).not.toBeNull();
    // The current stage's run must resolve from *this* record — its
    // elapsedActiveMs must equal the matching entry in `timings`, never a
    // 0 sentinel and never another intent's open run (findings 1/2).
    const currentSlug = remaining.currentStage?.stage;
    const ownRun = body.value.timings.find((t) => t.stage === currentSlug);
    expect(ownRun).toBeDefined();
    expect(remaining.currentStage?.elapsedActiveMs).toBe(ownRun?.activeMs);
    // The workspace's current stage is already closed (`endedAt` set) — no
    // work remains in it.
    expect(ownRun?.endedAt).not.toBeNull();
    expect(remaining.currentStage?.remainingMs).toBe(0);
    expect(remaining.totalRemainingMs).toBe(0);
  });

  it("is not part of the workflow payload (ADR-03 段階的初回描画)", async () => {
    const service = createGuideService({ workspaceRoot: REPO_ROOT });
    const result = await routeRead(service.readContext, route("/api/workflow"));
    expect(result?.body).not.toHaveProperty("timings");
  });
});
