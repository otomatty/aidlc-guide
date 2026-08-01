import { describe, expect, it } from "vitest";
import { MAPPED_STAGE_SLUGS, mapStageToDoc } from "../src/stage-map.ts";

const SEVEN = [
  "intent-capture",
  "feasibility",
  "scope-definition",
  "rough-mockups",
  "reverse-engineering",
  "practices-discovery",
  "requirements-analysis",
] as const;

describe("mapStageToDoc", () => {
  it("covers exactly the seven FR-U3.3 slugs with non-empty paths", () => {
    expect(MAPPED_STAGE_SLUGS).toHaveLength(7);
    expect([...MAPPED_STAGE_SLUGS].sort()).toEqual([...SEVEN].sort());

    for (const slug of SEVEN) {
      const ref = mapStageToDoc(slug);
      expect(ref).not.toBeNull();
      expect(ref?.path.length).toBeGreaterThan(0);
      expect(ref?.path.startsWith("guide/") || ref?.path.startsWith("reference/")).toBe(true);
    }
  });

  it("returns null for unmapped slugs", () => {
    expect(mapStageToDoc("user-stories")).toBeNull();
    expect(mapStageToDoc("code-generation")).toBeNull();
    expect(mapStageToDoc("")).toBeNull();
    expect(mapStageToDoc("  ")).toBeNull();
  });

  it("includes optional anchors on selected slugs", () => {
    expect(mapStageToDoc("intent-capture")?.anchor).toBe("approval-gates");
    expect(mapStageToDoc("feasibility")?.anchor).toBeUndefined();
  });
});
