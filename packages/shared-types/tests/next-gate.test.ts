import { describe, expect, it } from "vitest";
import {
  isNextGateOverrun,
  type NextGateEstimate,
  nextGateTarget,
  type StageView,
} from "../src/index.ts";

/**
 * The dashboard's Now strip and the VS Code status bar both name the next
 * gate and both decide when it is an overrun. These presenters are the one
 * copy of that wording and that rule.
 */

function gate(over: Partial<NextGateEstimate> = {}): NextGateEstimate {
  return {
    kind: "stage",
    stage: "code-generation",
    remainingMs: 2_700_000,
    stages: ["code-generation"],
    autoApproved: [],
    planApproval: false,
    lowConfidence: false,
    estimateCoverage: { known: 1, unknown: 0 },
    ...over,
  };
}

const running: Pick<StageView, "stage" | "running" | "elapsedActiveMs" | "estimateMs"> = {
  stage: "code-generation",
  running: true,
  elapsedActiveMs: 30 * 60_000,
  estimateMs: 20 * 60_000,
};

describe("nextGateTarget", () => {
  it("names the gate for each kind", () => {
    expect(nextGateTarget(gate())).toBe("code-generation の承認");
    expect(nextGateTarget(gate({ kind: "open" }))).toBe("code-generation の承認");
    expect(nextGateTarget(gate({ kind: "block", stage: "functional-design" }))).toBe(
      "全 Unit の完了後、functional-design から順に承認",
    );
    expect(nextGateTarget(gate({ kind: "unit" }))).toBe("code-generation 後の Unit 承認");
  });

  it("gives the work to completion when no gate is left but work is", () => {
    expect(nextGateTarget(gate({ kind: "none", stage: null, remainingMs: 900_000 }))).toBe(
      "完了まで ≈15m",
    );
  });

  it("names nothing without an estimate, or with neither a gate nor work left", () => {
    expect(nextGateTarget(null)).toBeNull();
    expect(nextGateTarget(gate({ kind: "none", stage: null, remainingMs: 0 }))).toBeNull();
    expect(nextGateTarget(gate({ kind: "none", stage: null, remainingMs: null }))).toBeNull();
  });
});

describe("isNextGateOverrun", () => {
  it("is an overrun when the overrun current stage is all that is summed", () => {
    expect(isNextGateOverrun(gate(), running)).toBe(true);
    expect(isNextGateOverrun(gate({ kind: "unit" }), running)).toBe(true);
  });

  it("is not an overrun while a later stage's estimate is part of the sum", () => {
    expect(
      isNextGateOverrun(gate({ stages: ["code-generation", "build-and-test"] }), running),
    ).toBe(false);
  });

  it("is not an overrun for another stage, an unfinished estimate, or an open or absent gate", () => {
    expect(isNextGateOverrun(gate({ stages: ["build-and-test"] }), running)).toBe(false);
    expect(isNextGateOverrun(gate(), { ...running, elapsedActiveMs: 10 * 60_000 })).toBe(false);
    expect(isNextGateOverrun(gate({ kind: "open", stages: [] }), running)).toBe(false);
    expect(isNextGateOverrun(gate({ kind: "none", stage: null }), running)).toBe(false);
  });
});
