import { describe, expect, it } from "vitest";
import {
  explainDepth,
  explainDone,
  explainGate,
  explainPhase,
  explainScope,
  explainStage,
} from "../src/components/now-strip-explain.ts";

describe("now-strip-explain", () => {
  it("explains each phase with a current-value meaning", () => {
    const explain = explainPhase("CONSTRUCTION");
    expect(explain.definition).toMatch(/大区分/);
    expect(explain.current).toMatch(/構築/);
    expect(explain.bullets.length).toBeGreaterThanOrEqual(2);
  });

  it("explains a missing current stage", () => {
    expect(explainStage(null).current).toMatch(/ありません/);
    expect(explainStage("code-generation").current).toContain("code-generation");
  });

  it("names the selected scope in the current meaning", () => {
    expect(explainScope("prd-implementation").current).toContain("prd-implementation");
  });

  it("maps known depths case-insensitively", () => {
    expect(explainDepth("Standard").current).toMatch(/標準/);
    expect(explainDepth("minimal").current).toMatch(/最小限/);
  });

  it("explains gate statuses and the null case", () => {
    expect(explainGate(null).current).toMatch(/ありません/);
    expect(explainGate("awaiting-approval").current).toMatch(/awaiting approval/);
  });

  it("explains the done/total progress pair", () => {
    expect(explainDone(3, 6).current).toContain("3 / 6");
    expect(explainDone(0, 0).current).toMatch(/0/);
  });
});
