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
   * docs-bridge and official-docs slug the raw markdown line; the Shell slugs
   * DOM text the renderer already stripped the closing marker from. Both must
   * land on the same anchor or the deep link resolves on one side only.
   */
  it("strips a CommonMark closing marker, so raw markdown and DOM text agree", () => {
    expect(slugifyHeading("## Feature scope ##")).toBe("feature-scope");
    expect(slugifyHeading("## Feature scope ##")).toBe(slugifyHeading("Feature scope"));
    expect(slugifyHeading("# Title #   ")).toBe("title");
  });

  it("keeps a trailing # that no whitespace precedes — it is content, not a marker", () => {
    expect(slugifyHeading("## C#")).toBe(slugifyHeading("C#"));
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
