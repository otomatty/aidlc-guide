import { describe, expect, it } from "vitest";
import { docsRoot, isDocSection, isLocale, localeContentRoot, parseDocPath } from "../src/roots.ts";
import { workspaceRoot } from "./helpers.ts";

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

  it("normalizes backslashes and leading slashes", () => {
    expect(parseDocPath("guide\\nested\\page.md")).toEqual({
      section: "guide",
      relFile: "nested/page.md",
      docPath: "guide/nested/page.md",
    });
    expect(parseDocPath("/guide/foo.md")?.docPath).toBe("guide/foo.md");
  });

  it("rejects malformed paths", () => {
    expect(parseDocPath("")).toBeNull();
    expect(parseDocPath("   ")).toBeNull();
    expect(parseDocPath("guide")).toBeNull();
    expect(parseDocPath("guide/")).toBeNull();
    expect(parseDocPath("guides/foo.md")).toBeNull();
    expect(parseDocPath("guide/\0foo.md")).toBeNull();
  });
});

describe("isLocale / isDocSection", () => {
  it("accepts only en and ja", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("accepts only guide and reference sections", () => {
    expect(isDocSection("guide")).toBe(true);
    expect(isDocSection("reference")).toBe(true);
    expect(isDocSection("guides")).toBe(false);
  });
});

describe("content roots", () => {
  it("resolves locale and docs roots under workspace", () => {
    expect(localeContentRoot(workspaceRoot, "guide", "ja")).toMatch(/docs[/\\]guide[/\\]ja$/);
    expect(docsRoot(workspaceRoot)).toMatch(/docs$/);
  });
});
