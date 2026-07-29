import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordFileTarget } from "../src/file-ref-target.ts";

const RECORD = path.resolve("/work/aidlc/records/current");

describe("recordFileTarget", () => {
  it("resolves a normalized path against the record directory", async () => {
    await expect(recordFileTarget(RECORD, "./construction/code.md")).resolves.toBe(
      path.join(RECORD, "construction", "code.md"),
    );
  });

  it.each(["", "/etc/passwd", "../secrets.md", "construction/../../secrets.md"])(
    "refuses an unsafe webview path %j",
    async (cited) => {
      await expect(recordFileTarget(RECORD, cited)).resolves.toBeNull();
    },
  );
});
