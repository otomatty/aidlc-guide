import { describe, expect, it } from "vitest";
import {
  compareReleaseIds,
  isPreviewRelease,
  isReleaseId,
  parseReleaseId,
} from "../src/version/release-id.ts";

const order = (left: string, right: string): number => {
  const a = parseReleaseId(left);
  const b = parseReleaseId(right);
  if (a === null || b === null) throw new Error(`not a release id: ${left} / ${right}`);
  return Math.sign(compareReleaseIds(a, b));
};

describe("release ids", () => {
  it("reads stable and preview ids the way upstream writes them", () => {
    expect(parseReleaseId("2.11.1")).toEqual({ major: 2, minor: 11, patch: 1, preview: null });
    expect(parseReleaseId("2.11.2-preview.20261020.3")).toEqual({
      major: 2,
      minor: 11,
      patch: 2,
      preview: { date: "20261020", build: 3 },
    });
    expect(isPreviewRelease("2.11.2-preview.20261020.3")).toBe(true);
    expect(isPreviewRelease("2.11.1")).toBe(false);
  });

  it.each(["v2.11.1", "2.11", "02.11.1", "2.11.1-rc.1", "2.11.2-preview.2026102.1", "2.11.2-preview.20261020.0", "latest"])(
    "refuses %s",
    (value) => {
      expect(isReleaseId(value)).toBe(false);
    },
  );

  it("refuses an id longer than upstream allows", () => {
    expect(isReleaseId(`${"9".repeat(80)}.0.0`)).toBe(false);
  });

  it("orders a stable release after its previews, and previews by date then counter", () => {
    expect(order("2.12.0", "2.11.1")).toBe(1);
    expect(order("2.11.2-preview.20261020.1", "2.11.1")).toBe(1);
    expect(order("2.11.2", "2.11.2-preview.20261020.1")).toBe(1);
    expect(order("2.11.2-preview.20261020.1", "2.11.2")).toBe(-1);
    expect(order("2.11.2-preview.20261021.1", "2.11.2-preview.20261020.9")).toBe(1);
    expect(order("2.11.2-preview.20261020.2", "2.11.2-preview.20261020.10")).toBe(-1);
    expect(order("2.11.1", "2.11.1")).toBe(0);
  });
});
