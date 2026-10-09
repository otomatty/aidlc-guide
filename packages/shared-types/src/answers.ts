/**
 * Which `[Answer]:` lines of a questions file the engine records from the chat.
 * Pure, so the dashboard (read-only fields) and the answer writer (refusal)
 * share one reading.
 *
 * aidlc-workflows v2.11.0 writes the whole Code Generation Plan Approval file
 * (aidlc-plan-approval-ask.ts `questionsFileContent`) and checks that its
 * `[Answer]:` is exactly the approved answer before it builds
 * (aidlc-testing-posture.ts "must contain exactly"), so a later edit stops the
 * build. The answer in a Consolidated Summary Confirmation section is bound to
 * the receipt the engine records (aidlc-lib.ts `summaryConfirmationAnswer`,
 * which reads that H2 section up to the next H2).
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
const H2 = /^##[ \t]/;
const SUMMARY_CONFIRMATION_HEADING =
  /^##[ \t]+Consolidated Summary Confirmation(?:[ \t]+#+)?[ \t]*$/;

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
  let summary = false;
  lines.forEach((line, index) => {
    if (H2.test(line)) summary = SUMMARY_CONFIRMATION_HEADING.test(line);
    if (!line.startsWith(ANSWER_PREFIX)) return;
    answers.push({
      line: index + 1,
      owner: plan ? "plan-approval" : summary ? "summary-confirmation" : null,
    });
  });
  return answers;
}

/** The chat checkpoint that owns `line`, or `null` when the person may write it. */
export function chatAnsweredLine(path: string, markdown: string, line: number): ChatAnswered | null {
  return scanAnswerLines(path, markdown).find((answer) => answer.line === line)?.owner ?? null;
}
