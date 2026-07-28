import type { TimingsPayload } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { selectCurrentTiming, selectTimingNotes } from "../src/store/select-timing.ts";
import { type AppState, initialState } from "../src/store/state.ts";
import { stageView, workflow } from "./fixtures.ts";

/**
 * Issue #10: `workflow` and `timings` are two independent fetches, so a change
 * push can advance the current stage while an in-flight timings response still
 * describes the previous one. NowStrip, Header and the VS Code status bar used
 * to each re-do that comparison. The dashboard now does it once, here, off the
 * payload's own `currentStage` snapshot — which is why these tests are the
 * only place the rule is stated.
 */

function timings(overrides: Partial<TimingsPayload> = {}): TimingsPayload {
  return {
    timings: [],
    currentStage: "code-generation",
    stageViews: [
      stageView("code-generation", { isCurrent: true, elapsedActiveMs: 60_000, remainingMs: 0 }),
      stageView("build-and-test", { remainingMs: 960_000 }),
    ],
    remaining: { totalRemainingMs: 960_000, lowConfidence: false },
    ...overrides,
  };
}

function state(over: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    workflow: { kind: "success", value: workflow() },
    timings: { kind: "success", value: timings() },
    ...over,
  };
}

describe("selectCurrentTiming", () => {
  it("resolves the current stage's view and the roll-up when the snapshots agree", () => {
    const selected = selectCurrentTiming(state());
    expect(selected.view?.stage).toBe("code-generation");
    expect(selected.remaining).toEqual({ totalRemainingMs: 960_000, lowConfidence: false });
  });

  it("withholds both while the payload still names the previous stage", () => {
    // The push landed: the workflow has moved on, `/api/timings` has not. Its
    // total still bills the stage that just finished, so neither the per-stage
    // numbers nor the roll-up may render under the new stage's name.
    const selected = selectCurrentTiming(
      state({ workflow: { kind: "success", value: workflow({ currentStage: "build-and-test" }) } }),
    );
    expect(selected.view).toBeNull();
    expect(selected.remaining).toBeNull();
  });

  it("withholds both while the workflow has not loaded", () => {
    const selected = selectCurrentTiming(state({ workflow: { kind: "loading" } }));
    expect(selected.view).toBeNull();
    expect(selected.remaining).toBeNull();
  });

  /**
   * CodeRabbit review on PR #18: "no workflow value" must not collapse into
   * "the workflow reports no current stage". A payload whose own snapshot is
   * `null` would otherwise pass the freshness check against a workflow that
   * was never read, and the header would show its total — a number nothing on
   * screen can be checked against.
   */
  it("withholds the roll-up from an unread workflow even when the payload names no stage", () => {
    const idleSnapshot = {
      kind: "success" as const,
      value: timings({
        currentStage: null,
        stageViews: [stageView("code-generation", { remainingMs: 960_000 })],
      }),
    };
    for (const workflowState of [
      { kind: "loading" as const },
      { kind: "error" as const, detail: "サーバに接続できません" },
      { kind: "empty" as const, hint: "アクティブなインテントがありません" },
    ]) {
      const selected = selectCurrentTiming(
        state({ workflow: workflowState, timings: idleSnapshot }),
      );
      expect(selected.view).toBeNull();
      expect(selected.remaining).toBeNull();
    }
  });

  it("withholds both while no timings payload has landed", () => {
    const selected = selectCurrentTiming(state({ timings: { kind: "loading" } }));
    expect(selected.view).toBeNull();
    expect(selected.remaining).toBeNull();
  });

  it("keeps the last payload rather than blanking when a request errors", () => {
    // The reducer's `error` state replaces the value, so this is about the
    // selector not inventing a value of its own: no payload, nothing shown.
    const selected = selectCurrentTiming(state({ timings: { kind: "error", detail: "x" } }));
    expect(selected.view).toBeNull();
    expect(selected.remaining).toBeNull();
  });

  it("reads a partial payload the same as a successful one", () => {
    const selected = selectCurrentTiming(
      state({ timings: { kind: "partial", value: timings(), notes: ["shard unreadable"] } }),
    );
    expect(selected.view?.stage).toBe("code-generation");
    expect(selected.remaining?.totalRemainingMs).toBe(960_000);
  });

  /**
   * A finished (or unstarted) workflow has no current stage on either side.
   * That is a match, not staleness: the roll-up is exactly what the header
   * should show — `残り実作業 ≈0`, not silence — while there is no per-stage
   * view to resolve.
   */
  it("agrees when neither side has a current stage, giving a roll-up but no view", () => {
    const selected = selectCurrentTiming(
      state({
        workflow: { kind: "success", value: workflow({ currentStage: null }) },
        timings: {
          kind: "success",
          value: timings({
            currentStage: null,
            stageViews: [stageView("code-generation", { status: "completed", remainingMs: 0 })],
            remaining: { totalRemainingMs: 0, lowConfidence: false },
          }),
        },
      }),
    );
    expect(selected.view).toBeNull();
    expect(selected.remaining).toEqual({ totalRemainingMs: 0, lowConfidence: false });
  });

  /**
   * The reason the snapshot is a payload field rather than something read back
   * off `StageView.isCurrent`: the `none` sentinel and a hand-edited state file
   * both produce a `currentStage` that names no row, so zero views carry
   * `isCurrent` — indistinguishable from "no stage is current" unless the
   * payload says which it was.
   */
  it("counts a currentStage naming no row as fresh, not as 'no current stage'", () => {
    const selected = selectCurrentTiming(
      state({
        workflow: { kind: "success", value: workflow({ currentStage: "nonexistent" }) },
        timings: {
          kind: "success",
          value: timings({
            currentStage: "nonexistent",
            stageViews: [stageView("code-generation", { remainingMs: 960_000 })],
          }),
        },
      }),
    );
    expect(selected.view).toBeNull(); // no row to resolve...
    expect(selected.remaining).not.toBeNull(); // ...but the payload is current
  });
});

describe("selectTimingNotes", () => {
  it("surfaces the notes of a partial payload", () => {
    expect(
      selectTimingNotes(
        state({ timings: { kind: "partial", value: timings(), notes: ["shard unreadable"] } }),
      ),
    ).toEqual(["shard unreadable"]);
  });

  it("is empty for every other view state", () => {
    expect(selectTimingNotes(state())).toEqual([]);
    expect(selectTimingNotes(state({ timings: { kind: "error", detail: "x" } }))).toEqual([]);
  });
});
