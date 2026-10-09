import { describe, expect, it } from "vitest";
import { chatAnsweredLine, scanAnswerLines } from "../src/index.ts";

const PLAN_FILE = "construction/unit-a/code-generation/code-generation-questions.md";
// aidlc-workflows v2.11.0 aidlc-plan-approval-ask.ts questionsFileContent.
const PLAN = [
  "# Code Generation Plan Approval",
  "",
  "## Plan Approval",
  "",
  "- A. Approve",
  "",
  "[Answer]: A",
  "",
].join("\n");
const SUMMARY_FILE = "inception/requirements-analysis/requirements-analysis-questions.md";
const SUMMARY = [
  "## Q1",
  "[Answer]: A",
  "## Consolidated Summary Confirmation ##",
  "[Answer]: A",
  "### detail",
  "[Answer]: B",
  "## Q2",
  "[Answer]:",
].join("\n");

describe("answers the engine records from the chat (v2.11.0)", () => {
  it("owns a Code Generation Plan Approval answer once it is given", () => {
    expect(scanAnswerLines(PLAN_FILE, PLAN)).toEqual([{ line: 7, owner: "plan-approval" }]);
    expect(chatAnsweredLine(PLAN_FILE, PLAN, 7)).toBe("plan-approval");
  });

  it("leaves a pending plan-approval answer for the person to write in the file", () => {
    for (const pending of ["[Answer]:", "[Answer]:   "]) {
      const blank = PLAN.replace("[Answer]: A", pending);
      expect(chatAnsweredLine(PLAN_FILE, blank, 7)).toBeNull();
    }
  });

  it("reads the heading through a BOM and CRLF line ends", () => {
    const crlf = `﻿${PLAN.replace(/\n/g, "\r\n")}`;
    expect(chatAnsweredLine(PLAN_FILE, crlf, 7)).toBe("plan-approval");
  });

  it("leaves a file of another name with the same heading to the person", () => {
    expect(chatAnsweredLine("construction/u/s/design-questions.md", PLAN, 7)).toBeNull();
  });

  it("owns only the answers inside a Consolidated Summary Confirmation section", () => {
    expect(scanAnswerLines(SUMMARY_FILE, SUMMARY)).toEqual([
      { line: 2, owner: null },
      { line: 4, owner: "summary-confirmation" },
      { line: 6, owner: "summary-confirmation" },
      { line: 8, owner: null },
    ]);
  });

  it.each([
    ["indented", "   ## Consolidated Summary Confirmation"],
    ["with a trailing comment", "## Consolidated Summary Confirmation <!-- checkpoint -->"],
  ])("recognizes a summary heading the engine sees: %s", (_, heading) => {
    const markdown = ["## Q1", "[Answer]: A", heading, "[Answer]: A", "   ## Q2", "[Answer]:"].join(
      "\n",
    );
    expect(scanAnswerLines(SUMMARY_FILE, markdown)).toEqual([
      { line: 2, owner: null },
      { line: 4, owner: "summary-confirmation" },
      { line: 6, owner: null },
    ]);
  });

  it.each([
    ["indented as code", "    ## Consolidated Summary Confirmation"],
    ["a comment right after the hashes", "##<!-- c --> Consolidated Summary Confirmation"],
    ["inside a comment", "<!-- ## Consolidated Summary Confirmation -->"],
    ["inside a code fence", "```\n## Consolidated Summary Confirmation\n```"],
    ["inside a multi-line comment", "<!--\n## Consolidated Summary Confirmation\n-->"],
  ])("leaves the answer to the person for what the engine does not read as the heading: %s", (_, heading) => {
    const markdown = ["## Q1", heading, "[Answer]: A"].join("\n");
    expect(scanAnswerLines(SUMMARY_FILE, markdown).map((answer) => answer.owner)).toEqual([null]);
  });

  it("answers nothing for a line that is not an answer or a file that is not a questions file", () => {
    expect(chatAnsweredLine(SUMMARY_FILE, SUMMARY, 3)).toBeNull();
    expect(chatAnsweredLine(SUMMARY_FILE, SUMMARY, 99)).toBeNull();
    expect(scanAnswerLines("construction/u/s/design.md", SUMMARY)).toEqual([]);
  });
});
