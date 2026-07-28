import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/index.ts";

/** The one formatDuration — shared by the dashboard and the VS Code status bar. */
describe("formatDuration", () => {
  it("renders an em dash for an absent duration", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("renders under a minute as a floor rather than 0m", () => {
    expect(formatDuration(0)).toBe("<1m");
    expect(formatDuration(5_000)).toBe("<1m");
  });

  it("renders minutes below an hour", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
  });

  it("renders exactly 60 minutes as 1h00m, zero-padded", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h00m");
  });

  it("renders hours and zero-padded minutes above an hour", () => {
    expect(formatDuration(2 * 60 * 60_000 + 10 * 60_000)).toBe("2h10m");
  });

  it("rounds to the nearest minute either side of the 30s midpoint", () => {
    expect(formatDuration(89_000)).toBe("1m"); // 1m29s rounds down
    expect(formatDuration(91_000)).toBe("2m"); // 1m31s rounds up
  });
});
