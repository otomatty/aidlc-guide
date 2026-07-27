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

/**
 * Mirrors `resolveCurrentRun` in reader-core/src/timing/estimate.ts: prefers
 * the open run for the slug, else the most recently closed one. A plain
 * `.find()` would return the *first* run for the slug instead — the two
 * agree by coincidence on a stage that has only run once, and diverge (and
 * make the test fail spuriously) the moment this record ever re-runs a stage.
 */
function resolveOwnRun(timings: readonly StageTiming[], slug: string): StageTiming | undefined {
  const runs = timings.filter((t) => t.stage === slug);
  const open = runs.find((t) => t.endedAt === null);
  if (open !== undefined) return open;
  return runs.reduce<StageTiming | undefined>((latestClosed, run) => {
    if (run.endedAt === null) return latestClosed;
    if (
      latestClosed === undefined ||
      Date.parse(run.endedAt) > Date.parse(latestClosed.endedAt as string)
    ) {
      return run;
    }
    return latestClosed;
  }, undefined);
}

describe("GET /api/timings", () => {
  // This reads the repository's own live workspace record, which grows every
  // time /aidlc runs here. It must therefore assert invariants that hold in
  // *every* workflow state (terminal or mid-flight), never a snapshot of
  // today's state — a snapshot assertion (e.g. "pendingStages is empty")
  // would go red for everyone the next time this repo's workflow advances,
  // with no code defect involved. See project.md / team.md's rule on
  // asserting invariants against live records.
  it("returns the active record's runs and a remaining estimate that satisfies its invariants", async () => {
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

    const { remaining, timings } = body.value;

    if (remaining.currentStage !== null) {
      const currentSlug = remaining.currentStage.stage;

      // Scoping (finding 2): the current stage's run must resolve from the
      // *active record's own* runs (`timings`), never the space-wide sample
      // pool — so a run for this slug must exist here at all.
      const ownRun = resolveOwnRun(timings, currentSlug);
      expect(ownRun).toBeDefined();

      // No 0-sentinel (finding 1): elapsed must equal the resolved run's
      // measured activeMs exactly, never defaulted to 0.
      expect(remaining.currentStage.elapsedActiveMs).toBe(ownRun?.activeMs);

      // remainingMs === 0 iff the resolved run is closed. An open run's
      // remainder is either unknown (null, no estimate available) or a
      // non-negative number — never the 0 that would claim a running stage
      // has no work left.
      if (ownRun?.endedAt !== null) {
        expect(remaining.currentStage.remainingMs).toBe(0);
      } else {
        const openRemaining = remaining.currentStage.remainingMs;
        expect(openRemaining === null || openRemaining >= 0).toBe(true);
      }

      // The current stage is represented once, by `currentStage` — it must
      // never also appear in `pendingStages` (double-counting risk).
      expect(remaining.pendingStages.some((s) => s.stage === currentSlug)).toBe(false);
    }

    // totalRemainingMs must equal the sum of the current stage's remainder
    // (if known) and every pending stage's non-null estimate. Recomputed here
    // rather than pinned to a literal, since the literal drifts with the
    // workflow's actual state.
    const currentRemaining =
      remaining.currentStage === null ? null : remaining.currentStage.remainingMs;
    const pendingSum = remaining.pendingStages.reduce((sum, s) => sum + (s.estimateMs ?? 0), 0);
    const somethingIsEstimated =
      currentRemaining !== null || remaining.pendingStages.some((s) => s.estimateMs !== null);

    if (somethingIsEstimated) {
      expect(remaining.totalRemainingMs).toBe((currentRemaining ?? 0) + pendingSum);
    } else {
      expect(remaining.totalRemainingMs).toBeNull();
    }
  });

  it("is not part of the workflow payload (ADR-03 段階的初回描画)", async () => {
    const service = createGuideService({ workspaceRoot: REPO_ROOT });
    const result = await routeRead(service.readContext, route("/api/workflow"));
    expect(result?.body).not.toHaveProperty("timings");
  });
});
