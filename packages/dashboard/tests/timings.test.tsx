import type { ReadResult, TimingsPayload } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";

const payload: TimingsPayload = {
  timings: [
    {
      stage: "code-generation",
      startedAt: "2026-07-25T05:41:30Z",
      endedAt: null,
      wallMs: 7_800_000,
      activeMs: 7_200_000,
      eventCount: 1201,
    },
  ],
  remaining: {
    currentStage: { stage: "code-generation", elapsedActiveMs: 7_200_000, remainingMs: 2_700_000 },
    pendingStages: [
      {
        stage: "build-and-test",
        estimateMs: 960_000,
        rangeMs: null,
        sampleCount: 1,
        basis: "stage",
      },
    ],
    totalRemainingMs: 3_660_000,
    lowConfidence: true,
  },
};

describe("timings slice", () => {
  it("starts as loading", () => {
    expect(initialState.timings).toEqual({ kind: "loading" });
  });

  it("stores a successful payload", () => {
    const result: ReadResult<TimingsPayload> = { ok: true, value: payload };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings).toEqual({ kind: "success", value: payload });
  });

  it("surfaces a read failure as an error view state", () => {
    const result: ReadResult<TimingsPayload> = { error: true, reason: "state-missing" };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings.kind).toBe("error");
  });

  it("keeps warnings as a partial view state", () => {
    const result: ReadResult<TimingsPayload> = {
      ok: true,
      value: payload,
      warnings: ["intent skipped: broken"],
    };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings).toEqual({
      kind: "partial",
      value: payload,
      notes: ["intent skipped: broken"],
    });
  });
});
