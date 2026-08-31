import { describe, expect, it } from "vitest";
import {
  DOC_SECTIONS,
  docsRoot,
  isDocSection,
  isLocale,
  localeContentRoot,
  parseDocPath,
  upstreamSectionSource,
} from "../src/roots.ts";
import { workspaceRoot } from "./helpers.ts";

describe("parseDocPath", () => {
  it("accepts a DocPath in every bundled section", () => {
    for (const section of DOC_SECTIONS) {
      expect(parseDocPath(`${section}/page.md`)).toEqual({
        section,
        relFile: "page.md",
        docPath: `${section}/page.md`,
      });
    }
  });

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

  it("accepts every bundled section and nothing else", () => {
    for (const section of DOC_SECTIONS) expect(isDocSection(section)).toBe(true);
    expect(isDocSection("guides")).toBe(false);
    expect(isDocSection("prd")).toBe(false);
  });
});

describe("upstreamSectionSource", () => {
  // The nav renders these in order, and the mirror walks them in it.
  it("lists upstream's books in reading order", () => {
    expect([...DOC_SECTIONS]).toEqual([
      "overview",
      "guide",
      "harness-engineering",
      "reference",
      "rfcs",
    ]);
  });

  it("maps a section directory to itself, read recursively", () => {
    for (const section of DOC_SECTIONS.filter((s) => s !== "overview")) {
      expect(upstreamSectionSource(section)).toEqual({ relDir: section, recursive: true });
    }
  });

  // overview's pages are the loose files in upstream's docs root; descending
  // from there would mirror every other section a second time beneath it.
  it("maps overview to the docs root, read non-recursively", () => {
    expect(upstreamSectionSource("overview")).toEqual({ relDir: ".", recursive: false });
  });
});

describe("content roots", () => {
  it("resolves locale and docs roots under workspace", () => {
    expect(localeContentRoot(workspaceRoot, "guide", "ja")).toMatch(/docs[/\\]guide[/\\]ja$/);
    expect(docsRoot(workspaceRoot)).toMatch(/docs$/);
  });
});
