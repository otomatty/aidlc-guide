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

  it("ignores empty h1 text", () => {
    expect(extractTitle("# \n\n## Sub")).toBeUndefined();
    expect(extractTitle("## Only sub\n")).toBeUndefined();
  });

  it("extracts h1 after a tilde fence", () => {
    const md = ["~~~", "# Not title", "~~~", "", "# After fence"].join("\n");
    expect(extractTitle(md)).toBe("After fence");
  });

  it("detects heading presence for anchors", () => {
    const md = "# Root\n\n## Approval gates\n\nbody\n";
    expect(headingExists(md, "approval-gates")).toBe(true);
    expect(headingExists(md, "#Approval gates")).toBe(true);
    expect(headingExists(md, "missing")).toBe(false);
    expect(headingExists(md, "")).toBe(false);
  });

  it("ignores headings inside fences when matching anchors", () => {
    const md = [
      "```",
      "## Fake heading",
      "```",
      "",
      "## Real heading",
      "",
      "~~~",
      "## Also fake",
      "~~~",
    ].join("\n");
    expect(headingExists(md, "fake-heading")).toBe(false);
    expect(headingExists(md, "also-fake")).toBe(false);
    expect(headingExists(md, "real-heading")).toBe(true);
  });

  it("does not close a backtick fence on a tilde marker", () => {
    const md = ["```", "~~~", "# Still fenced", "```", "", "# Outside"].join("\n");
    expect(extractTitle(md)).toBe("Outside");
    expect(headingExists(md, "still-fenced")).toBe(false);
    expect(headingExists(md, "outside")).toBe(true);
  });
});
