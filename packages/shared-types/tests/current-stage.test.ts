import { describe, expect, it } from "vitest";
import type { TimingsPayload } from "../src/index.ts";
import { currentStageView, timingsMatchStage } from "../src/index.ts";

/**
 * The freshness rule between the two independent reads (issue #10), stated
 * once here so the dashboard store and the VS Code status bar cannot define
 * it differently. `StageView`s are stubbed to the two fields these functions
 * read — everything else about a view is reader-core's business.
 */
type Views = TimingsPayload["stageViews"];

function payload(currentStage: string | null, current: string | null): TimingsPayload {
  const views = ["code-generation", "build-and-test"].map((stage) => ({
    stage,
    isCurrent: stage === current,
  })) as unknown as Views;
  return { timings: [], currentStage, stageViews: views, remaining: null as never };
}

describe("timingsMatchStage", () => {
  it("matches when both name the same stage", () => {
    expect(
      timingsMatchStage("code-generation", payload("code-generation", "code-generation")),
    ).toBe(true);
  });

  it("does not match when the payload names the stage that was current a moment ago", () => {
    expect(timingsMatchStage("build-and-test", payload("code-generation", "code-generation"))).toBe(
      false,
    );
  });

  it("matches when neither side has a current stage", () => {
    expect(timingsMatchStage(null, payload(null, null))).toBe(true);
  });

  it("does not match when exactly one side has a current stage", () => {
    expect(timingsMatchStage(null, payload("code-generation", "code-generation"))).toBe(false);
    expect(timingsMatchStage("code-generation", payload(null, null))).toBe(false);
  });

  it("treats an absent payload as never fresh", () => {
    expect(timingsMatchStage("code-generation", null)).toBe(false);
    expect(timingsMatchStage(null, null)).toBe(false);
  });
});

describe("currentStageView", () => {
  it("returns the marked view when the payload is fresh", () => {
    expect(
      currentStageView("code-generation", payload("code-generation", "code-generation"))?.stage,
    ).toBe("code-generation");
  });

  it("returns null when the payload is stale, even though it marks a view", () => {
    expect(currentStageView("build-and-test", payload("code-generation", "code-generation"))).toBe(
      null,
    );
  });

  it("returns null when the payload is fresh but marks no view", () => {
    // `currentStage` naming no row: the `none` sentinel, or a hand-edited
    // state file. Fresh, but there is nothing to resolve.
    expect(currentStageView("nonexistent", payload("nonexistent", null))).toBe(null);
    expect(currentStageView(null, payload(null, null))).toBe(null);
  });

  it("returns null for an absent payload", () => {
    expect(currentStageView("code-generation", null)).toBe(null);
  });
});
