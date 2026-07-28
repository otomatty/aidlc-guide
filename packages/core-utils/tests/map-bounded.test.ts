import { describe, expect, it } from "vitest";
import { mapBounded } from "../src/map-bounded.ts";

describe("mapBounded", () => {
  it("keeps result order regardless of completion order", async () => {
    const delays = [30, 0, 15, 5];
    const out = await mapBounded(delays, 2, async (ms, index) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return index;
    });
    expect(out).toEqual([0, 1, 2, 3]);
  });

  it("never runs more than `limit` calls concurrently", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapBounded(
      Array.from({ length: 12 }, (_, i) => i),
      3,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // it did actually parallelise
  });

  it("handles an empty list and a limit larger than the list", async () => {
    expect(await mapBounded([], 4, async (x) => x)).toEqual([]);
    expect(await mapBounded([1, 2], 100, async (x) => x * 2)).toEqual([2, 4]);
  });

  it("rejects on the first failing call, like Promise.all", async () => {
    await expect(
      mapBounded([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("boom");
        return x;
      }),
    ).rejects.toThrow("boom");
  });
});
