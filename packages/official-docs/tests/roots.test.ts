import { describe, expect, it } from "vitest";
import { isLocale, parseDocPath } from "../src/roots.ts";

describe("parseDocPath", () => {
  it("accepts guide and reference DocPaths", () => {
    expect(parseDocPath("guide/getting-started.md")).toEqual({
      section: "guide",
      relFile: "getting-started.md",
      docPath: "guide/getting-started.md",
    });
    expect(parseDocPath("reference/a/b.md")).toEqual({
      section: "reference",
      relFile: "a/b.md",
      docPath: "reference/a/b.md",
    });
  });

  it("rejects malformed paths", () => {
    expect(parseDocPath("")).toBeNull();
    expect(parseDocPath("guide")).toBeNull();
    expect(parseDocPath("guide/")).toBeNull();
    expect(parseDocPath("guides/foo.md")).toBeNull();
    expect(parseDocPath("/guide/foo.md")?.docPath).toBe("guide/foo.md");
  });
});

describe("isLocale", () => {
  it("accepts only en and ja", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
