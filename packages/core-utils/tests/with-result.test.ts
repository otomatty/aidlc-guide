import { describe, expect, it } from "vitest";
import { withResult } from "../src/with-result.ts";

describe("withResult — R-RC-1 last line of defence", () => {
  it("passes a normal result through untouched", async () => {
    expect(await withResult(async () => ({ ok: true, value: 42 }))).toEqual({
      ok: true,
      value: 42,
    });
  });

  it("passes an error result through untouched", async () => {
    expect(await withResult(async () => ({ error: true, reason: "state-missing" }))).toEqual({
      error: true,
      reason: "state-missing",
    });
  });

  it("normalises a thrown Error into an error result", async () => {
    expect(
      await withResult(() => {
        throw new Error("EMFILE: too many open files");
      }),
    ).toEqual({ error: true, reason: "internal: EMFILE: too many open files" });
  });

  it("normalises a rejected promise", async () => {
    expect(await withResult(async () => Promise.reject(new Error("boom")))).toEqual({
      error: true,
      reason: "internal: boom",
    });
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
