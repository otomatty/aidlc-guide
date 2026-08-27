import { describe, expect, it } from "vitest";
import { electSelected, isIntentDirName } from "../src/select.ts";

describe("electSelected", () => {
  it("uses persisted when it is listed", () => {
    expect(electSelected(["a", "b"], "b")).toBe("b");
  });

  it("uses the lone record when persisted is missing", () => {
    expect(electSelected(["only"], null)).toBe("only");
  });

  it("returns null when several records and no persisted", () => {
    expect(electSelected(["a", "b"], null)).toBeNull();
  });

  it("ignores a deleted persisted slug and falls back to lone or null", () => {
    expect(electSelected(["a", "b"], "gone")).toBeNull();
    expect(electSelected(["a"], "gone")).toBe("a");
  });
});

describe("isIntentDirName", () => {
  it("accepts a listed directory name", () => {
    expect(isIntentDirName("260101-guide", ["260101-guide", "other"])).toBe(true);
  });

  it("rejects empty names, path separators, and parent hops", () => {
    const all = ["a"];
    expect(isIntentDirName("", all)).toBe(false);
    expect(isIntentDirName("a/b", all)).toBe(false);
    expect(isIntentDirName("a\\b", all)).toBe(false);
    expect(isIntentDirName("..", all)).toBe(false);
    expect(isIntentDirName("../a", all)).toBe(false);
    expect(isIntentDirName("missing", all)).toBe(false);
  });
});
