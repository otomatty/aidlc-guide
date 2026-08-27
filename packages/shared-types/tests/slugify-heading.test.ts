import { describe, expect, it } from "vitest";
import { normalizeAnchor, slugifyHeading } from "../src/index.ts";

/**
 * The canonical anchor cases. docs-bridge, official-docs and the dashboard
 * Shell all resolve deep links through this one function, so the rules it
 * encodes are asserted once, here, rather than per surface.
 */
describe("slugifyHeading — GitHub anchor algorithm", () => {
  it("downcases and joins words with hyphens", () => {
    expect(slugifyHeading("Build and Test")).toBe("build-and-test");
    expect(slugifyHeading("Approval gates")).toBe("approval-gates");
  });

  it("strips ATX markers at any level", () => {
    expect(slugifyHeading("## Feature scope")).toBe("feature-scope");
    expect(slugifyHeading("### Nested Detail")).toBe("nested-detail");
  });

  /**
   * The two sides of a deep link hand this function different forms of the
   * same heading: docs-bridge and official-docs pass the raw markdown line,
   * the Shell passes the rendered DOM text. Every pair below must land on one
   * anchor, or the link resolves on the writing side and not the matching one.
   */
  it.each([
    // A real closing marker: syntax on the raw line, gone from rendered text.
    ["## Feature scope ##", "Feature scope"],
    ["# Title #   ", "Title"],
    // Trailing hashes that are *content* (here a code span). Nothing is
    // stripped from either side — on rendered text they are just characters.
    ["## Command `##`", "Command ##"],
    // No whitespace before the hash, so it was never a marker: CommonMark.
    ["## C#", "C#"],
    ["## Sharp #", "Sharp"],
  ])("agrees between the raw line %s and its rendered text", (raw, rendered) => {
    expect(slugifyHeading(raw)).toBe(slugifyHeading(rendered));
  });

  it("resolves the closing-marker heading to the anchor GitHub would emit", () => {
    expect(slugifyHeading("## Feature scope ##")).toBe("feature-scope");
    expect(slugifyHeading("## Objective-C#")).toBe("objective-c");
  });

  it("drops punctuation but keeps the spaces around it — GitHub's double hyphen", () => {
    expect(slugifyHeading("Setup & Install")).toBe("setup--install");
    expect(slugifyHeading("Step 2: Ensure the Space")).toBe("step-2-ensure-the-space");
  });

  it("keeps non-Latin word characters, so Japanese headings anchor", () => {
    expect(slugifyHeading("## 承認 ゲート")).toBe("承認-ゲート");
  });

  it("keeps underscores and existing hyphens", () => {
    expect(slugifyHeading("read_bounded and guard-path")).toBe("read_bounded-and-guard-path");
  });
});

describe("normalizeAnchor", () => {
  it("treats a leading # and surrounding space as noise", () => {
    expect(normalizeAnchor("#foo")).toBe("foo");
    expect(normalizeAnchor("  #Foo ")).toBe("foo");
    expect(normalizeAnchor("foo")).toBe("foo");
  });

  it("normalizes a copied anchor the same way as the heading it points at", () => {
    expect(normalizeAnchor("#Setup & Install")).toBe(slugifyHeading("## Setup & Install"));
  });
});
