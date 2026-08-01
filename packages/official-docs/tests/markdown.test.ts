import { describe, expect, it } from "vitest";
import { extractTitle, headingExists, slugifyHeading } from "../src/markdown.ts";

describe("markdown helpers", () => {
  it("slugifies headings like GitHub", () => {
    expect(slugifyHeading("Approval gates")).toBe("approval-gates");
    expect(slugifyHeading("## Feature scope")).toBe("feature-scope");
  });

  it("extracts the first h1 and ignores fenced headings", () => {
    const md = ["```", "# Not title", "```", "", "# Real Title", "", "## Sub"].join("\n");
    expect(extractTitle(md)).toBe("Real Title");
  });

  it("detects heading presence for anchors", () => {
    const md = "# Root\n\n## Approval gates\n\nbody\n";
    expect(headingExists(md, "approval-gates")).toBe(true);
    expect(headingExists(md, "#Approval gates")).toBe(true);
    expect(headingExists(md, "missing")).toBe(false);
    expect(headingExists(md, "")).toBe(false);
  });
});
