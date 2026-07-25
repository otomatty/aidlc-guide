import { describe, expect, it } from "vitest";
import { withResult } from "../src/util/with-result.ts";

describe("withResult — R-DB-1 last line of defence", () => {
  it("passes a result through untouched", async () => {
    expect(await withResult(async () => ({ ok: true, value: 42 }))).toEqual({
      ok: true,
      value: 42,
    });
  });

  it("normalises a thrown Error into an error result", async () => {
    expect(
      await withResult(() => {
        throw new Error("EMFILE: too many open files");
      }),
    ).toEqual({ error: true, reason: "internal: EMFILE: too many open files" });
  });

  it("normalises a thrown non-Error", async () => {
    expect(
      await withResult(() => {
        // Not an Error instance: exercises the String(cause) fallback.
        throw "just a string";
      }),
    ).toEqual({ error: true, reason: "internal: just a string" });
  });
});
