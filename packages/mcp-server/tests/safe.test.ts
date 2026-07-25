import path from "node:path";
import { describe, expect, it } from "vitest";
import { safeHandler } from "../src/safe.ts";
import { expectNormalReply, ROOT } from "./support.ts";

describe("safeHandler (R-MS-1)", () => {
  it("passes a healthy reply through untouched", async () => {
    const reply = { text: "fine", data: 1 };
    expect(await safeHandler(ROOT, async () => reply)()).toBe(reply);
  });

  it("turns a thrown Error into a normal 内部エラー reply", async () => {
    const handler = safeHandler(ROOT, async () => {
      throw new Error("boom");
    });
    const reply = expectNormalReply(await handler());
    expect(reply.text).toBe("内部エラー: boom");
    expect(reply.degraded).toEqual({ kind: "error", detail: "internal" });
  });

  it("survives a non-Error throw", async () => {
    const handler = safeHandler(ROOT, async () => {
      throw "just a string";
    });
    expect(expectNormalReply(await handler()).text).toBe("内部エラー: just a string");
  });

  it("does not leak the workspace root out of a thrown message (S-MS-4)", async () => {
    const handler = safeHandler(ROOT, async () => {
      throw new Error(`EACCES: ${path.join(ROOT, "aidlc", "state.md")}`);
    });
    const { text } = expectNormalReply(await handler());
    expect(text).not.toContain(ROOT);
    expect(text).toContain(path.join("aidlc", "state.md"));
  });

  it("forwards the handler's arguments", async () => {
    const handler = safeHandler(ROOT, async (a: number, b: number) => ({ text: `${a + b}` }));
    expect((await handler(2, 3)).text).toBe("5");
  });
});
