import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RemainingEstimate, StageTiming, StageView } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { routeRead } from "../src/handlers/read.ts";
import { createGuideService } from "../src/service.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Dashboard pin is independent of `active-intent`; live smoke still needs a record. */
const LIVE_INTENT = process.env.AIDLC_ACTIVE_INTENT?.trim() || "260720-aidlc-guide-prd";

function liveService() {
  return createGuideService({ workspaceRoot: REPO_ROOT, initialSelected: LIVE_INTENT });
}

function route(pathname: string) {
  return new URL(`http://localhost${pathname}`);
}

describe("GET /api/timings", () => {
  // This reads the repository's own live workspace record, which grows every
  // time /aidlc runs here. It must therefore assert invariants that hold in
  // *every* workflow state (terminal or mid-flight), never a snapshot of
  // today's state — a snapshot assertion (e.g. "pendingStages is empty")
  // would go red for everyone the next time this repo's workflow advances,
  // with no code defect involved. See project.md / team.md's rule on
  // asserting invariants against live records.
  it("returns the active record's runs and stage views that satisfy their invariants", async () => {
    const result = await routeRead(liveService().readContext, route("/api/timings"));

    expect(result?.status).toBe(200);
    const body = result?.body as {
      ok: true;
      value: {
        timings: StageTiming[];
        currentStage: string | null;
        stageViews: StageView[];
        remaining: RemainingEstimate;
      };
    };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.value.timings)).toBe(true);
    // The run count is a property of this workspace's history, which grows as
    // the live record advances (see the file-level comment) — only
    // non-emptiness is asserted here. A silently-empty result would still be
    // a real defect, so this stays a check rather than being deleted; the
    // invariants below carry the actual verification.
    expect(body.value.timings.length).toBeGreaterThan(0);

    const { remaining, stageViews, timings } = body.value;
    expect(stageViews.length).toBeGreaterThan(0);
    // At most one current stage, and it is the state file's, not a guess.
    expect(stageViews.filter((v) => v.isCurrent).length).toBeLessThanOrEqual(1);
    // The payload's `currentStage` snapshot is what a consumer compares its
    // own workflow read against (issue #10), so it must agree with the view
    // it marked: either it names that view's stage, or — when it names a row
    // that does not exist, or no stage at all — no view is marked.
    const currentView = stageViews.find((v) => v.isCurrent) ?? null;
    if (currentView !== null) expect(body.value.currentStage).toBe(currentView.stage);
    else expect(stageViews.some((v) => v.stage === body.value.currentStage)).toBe(false);

    const ownRuns = new Set(timings);
    for (const view of stageViews) {
      // Scoping: every run a view claims must come from the *active record's
      // own* runs, never the space-wide sample pool — a foreign intent's run
      // for the same slug must not be adopted as this record's.
      for (const run of [
        ...(view.currentAttempt === null ? [] : [view.currentAttempt]),
        ...view.history,
      ]) {
        expect(ownRuns.has(run)).toBe(true);
        expect(run.stage).toBe(view.stage);
      }
      // The attempt in play is never also listed as an earlier attempt.
      expect(view.history).not.toContain(view.currentAttempt);
      // `running` is the data's answer, and an open run has no final duration.
      expect(view.running).toBe(view.currentAttempt?.endedAt === null);
      expect(view.actualActiveMs).toBe(view.running ? null : view.elapsedActiveMs);
      // No 0-sentinel: elapsed is the attempt's measured activeMs or nothing.
      expect(view.elapsedActiveMs).toBe(view.currentAttempt?.activeMs ?? null);
      // A remainder is never negative, and never claims a running stage is done.
      if (view.remainingMs !== null) expect(view.remainingMs).toBeGreaterThanOrEqual(0);
      // Finished, skipped or out of scope ⇒ nothing left.
      if (view.execution === "SKIP" || view.status === "skipped" || view.status === "completed") {
        expect(view.remainingMs).toBe(0);
      }
    }

    // The roll-up is exactly the sum over the counted views — recomputed here
    // rather than pinned to a literal, since the literal drifts with the
    // workflow's actual state.
    const counted = stageViews.filter((v) => v.countsTowardRemaining);
    const parts = counted.flatMap((v) => (v.remainingMs === null ? [] : [v.remainingMs]));
    if (parts.length > 0) {
      expect(remaining.totalRemainingMs).toBe(parts.reduce((a, b) => a + b, 0));
    } else {
      expect(remaining.totalRemainingMs).toBeNull();
    }
  });

  it("is not part of the workflow payload (ADR-03 段階的初回描画)", async () => {
    const result = await routeRead(liveService().readContext, route("/api/workflow"));
    expect(result?.body).not.toHaveProperty("timings");
  });
});
