import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readExcerpt, sliceSection, slugifyHeading } from "../src/excerpt.ts";
import { DOCS_ROOT } from "./paths.ts";

const guide = await readFile(path.join(DOCS_ROOT, "guide.md"), "utf8");

describe("slugifyHeading — GitHub anchor normalization", () => {
  it("lowercases and turns spaces into hyphens", () => {
    expect(slugifyHeading("Build and Test")).toBe("build-and-test");
  });

  it("strips punctuation but keeps the surrounding spaces, so `&` yields a double hyphen", () => {
    expect(slugifyHeading("Setup & Install")).toBe("setup--install");
    expect(slugifyHeading("Step 2: Ensure the Space")).toBe("step-2-ensure-the-space");
  });

  it("accepts a heading line with its leading hashes", () => {
    expect(slugifyHeading("### Nested Detail")).toBe("nested-detail");
  });

  it("keeps non-ASCII letters (the aidlc docs are partly Japanese)", () => {
    expect(slugifyHeading("## 承認 ゲート")).toBe("承認-ゲート");
  });
});

describe("sliceSection", () => {
  it("ends the section at the next heading of the same level", () => {
    const section = sliceSection(guide, "#setup--install");
    expect(section).toBe(
      [
        "## Setup & Install",
        "",
        "Setup body line one.",
        "",
        "### Nested Detail",
        "",
        "Nested body — a level-3 heading must NOT end its level-2 parent.",
      ].join("\n"),
    );
  });

  it("ends the section at a shallower heading too", () => {
    const section = sliceSection(guide, "fenced");
    expect(section?.startsWith("## Fenced")).toBe(true);
    expect(section).not.toContain("Second Root");
  });

  it("ignores headings inside fenced blocks", () => {
    // Without fence awareness the section would stop at "## Not A Heading".
    expect(sliceSection(guide, "fenced")).toContain("Body after the fence");
  });

  it("tolerates a leading '#' on the anchor, and casing", () => {
    expect(sliceSection(guide, "#Next-Section")).toBe(sliceSection(guide, "next-section"));
  });

  it("returns null for an anchor that does not exist", () => {
    expect(sliceSection(guide, "#no-such-heading")).toBeNull();
  });

  it("returns null for an empty anchor rather than matching the first heading", () => {
    expect(sliceSection(guide, "#")).toBeNull();
  });

  it("runs to end of file when nothing closes the section", () => {
    expect(sliceSection(guide, "second-root")).toContain("shallower heading always closes");
  });
});

describe("readExcerpt — degradation is a warning, never a throw", () => {
  it("reads and slices a real file", async () => {
    const result = await readExcerpt(DOCS_ROOT, "guide.md", "#setup--install");
    expect(result.warning).toBeUndefined();
    expect(result.excerpt).toContain("Setup body line one.");
  });

  it("rejects a path that escapes docsRepoPath (S-DB-2)", async () => {
    const result = await readExcerpt(DOCS_ROOT, "../outside/secret.md", "#secret");
    expect(result.excerpt).toBeNull();
    expect(result.warning).toMatch(/outside docsRepoPath/);
  });

  it("rejects an absolute path outside docsRepoPath", async () => {
    const outside = path.join(DOCS_ROOT, "..", "outside", "secret.md");
    const result = await readExcerpt(DOCS_ROOT, path.resolve(outside), "#secret");
    expect(result.excerpt).toBeNull();
    expect(result.warning).toMatch(/outside docsRepoPath/);
  });

  it("warns when the file is missing", async () => {
    const result = await readExcerpt(DOCS_ROOT, "nope.md", "#anything");
    expect(result.excerpt).toBeNull();
    expect(result.warning).toMatch(/unreadable/);
  });

  it("warns when the anchor is missing", async () => {
    const result = await readExcerpt(DOCS_ROOT, "guide.md", "#ghost");
    expect(result.excerpt).toBeNull();
    expect(result.warning).toMatch(/anchor not found/);
  });
});
