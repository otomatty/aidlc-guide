/**
 * Which `[Answer]:` lines of a questions file the engine records from the chat.
 * Pure, so the dashboard (read-only fields) and the answer writer (refusal)
 * share one reading.
 *
 * aidlc-workflows v2.11.0 writes the whole Code Generation Plan Approval file
 * (aidlc-plan-approval-ask.ts `questionsFileContent`) and checks that its
 * `[Answer]:` is exactly the approved answer before it builds
 * (aidlc-testing-posture.ts "must contain exactly"), so an edit after the answer
 * stops the build; a blank answer there is still the person's to write. The answer in a Consolidated Summary Confirmation section is bound to
 * the receipt the engine records (aidlc-lib.ts `summaryConfirmationAnswer`,
 * which reads that H2 section up to the next H2, with its visible-heading rules).
 */

export const ANSWER_PREFIX = "[Answer]:";

export type ChatAnswered = "plan-approval" | "summary-confirmation";

export interface AnswerLine {
  /** 1-based line number. */
  line: number;
  /** Who answers it: `null` for the person, otherwise the chat checkpoint. */
  owner: ChatAnswered | null;
}

const PLAN_APPROVAL_FILE = "code-generation-questions.md";
const PLAN_APPROVAL_HEADING = "# Code Generation Plan Approval";
const SUMMARY_CONFIRMATION_TITLE = "Consolidated Summary Confirmation";
/** An ATX H2 as aidlc-lib.ts `visibleAtxHeading` reads it: up to three leading spaces. */
const H2 = /^ {0,3}##(?:[ \t]+|$)(.*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/** Stands where a comment was, so `##<!-- c --> Title` keeps no space after `##`. */
const COMMENT_MARK = "\u0000";

/**
 * Each line's visible text, as the engine projects it: HTML comments (also
 * across lines) removed, and fenced code blank, since neither holds a heading.
 */
function visibleLines(lines: string[]): string[] {
  let inComment = false;
  let fence: string | null = null;
  return lines.map((line) => {
    if (fence !== null) {
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`).test(line)) fence = null;
      return "";
    }
    let visible = "";
    let rest = line;
    while (rest !== "") {
      if (inComment) {
        const end = rest.indexOf("-->");
        if (end === -1) break;
        rest = rest.slice(end + 3);
        inComment = false;
        visible += COMMENT_MARK;
      } else {
        const start = rest.indexOf("<!--");
        if (start === -1) {
          visible += rest;
          break;
        }
        visible += rest.slice(0, start);
        rest = rest.slice(start + 4);
        inComment = true;
      }
    }
    const opened = inComment ? null : FENCE.exec(visible);
    if (opened?.[1] !== undefined) fence = opened[1];
    return visible;
  });
}

function h2Title(visible: string): string | null {
  const heading = H2.exec(visible);
  if (heading === null) return null;
  return (heading[1] ?? "")
    .replaceAll(COMMENT_MARK, "")
    .replace(/[ \t]+#+[ \t]*$/, "")
    .trim();
}

/** Every `[Answer]:` line of a `*-questions.md` file; empty for any other file. */
export function scanAnswerLines(path: string, markdown: string): AnswerLine[] {
  if (!path.endsWith("-questions.md")) return [];
  const lines = markdown
    .replace(/^﻿/, "")
    .split("\n")
    .map((line) => line.replace(/\r$/, ""));
  const plan =
    path.split(/[/\\]/).at(-1) === PLAN_APPROVAL_FILE &&
    lines[0]?.trimEnd() === PLAN_APPROVAL_HEADING;
  const answers: AnswerLine[] = [];
  const visible = visibleLines(lines);
  let summary = false;
  lines.forEach((line, index) => {
    const title = h2Title(visible[index] ?? "");
    if (title !== null) summary = title === SUMMARY_CONFIRMATION_TITLE;
    if (!line.startsWith(ANSWER_PREFIX)) return;
    // The engine invites a plan-approval answer in this file (its intro: "To
    // answer here instead of in chat, write your answer after `[Answer]:`"),
    // so only an answer already given is the engine's to keep.
    const answered = line.slice(ANSWER_PREFIX.length).trim() !== "";
    answers.push({
      line: index + 1,
      owner: plan && answered ? "plan-approval" : summary ? "summary-confirmation" : null,
    });
  });
  return answers;
}

/** The chat checkpoint that owns `line`, or `null` when the person may write it. */
export function chatAnsweredLine(
  path: string,
  markdown: string,
  line: number,
): ChatAnswered | null {
  return scanAnswerLines(path, markdown).find((answer) => answer.line === line)?.owner ?? null;
}
