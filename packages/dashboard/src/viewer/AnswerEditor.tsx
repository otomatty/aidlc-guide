import type { AnswerError } from "@aidlc-guide/shared-types";
import { type ReactNode, useId, useState } from "react";
import { type SaveResult, saveAnswer } from "./services/answer.ts";

/**
 * US-14 / FR-6.2. The only editable thing in the whole application: the text
 * after `[Answer]:` on a `[Answer]:` line of a `*-questions.md` file.
 *
 * In host mode this component **returns nothing** — the fields are absent from
 * the DOM, not hidden with CSS (S-AV-2 / US-11). The server's 403 is the real
 * gate; this is the other half of the double defence.
 */

export const ANSWER_PREFIX = "[Answer]:";

export interface AnswerEditorProps {
  path: string;
  /** 1-based line numbers, from {@link answerLinesOf}. */
  answerLines: number[];
  markdown: string;
  hostMode: boolean;
  /** Receives the **re-read** body, never a locally patched string (D2). */
  onSaved: (markdown: string) => void;
}

/** The `[Answer]:` lines of an artifact, 1-based. Empty for any other file. */
export function answerLinesOf(path: string, markdown: string): number[] {
  if (!/-questions\.md$/.test(path)) return [];
  const lines: number[] = [];
  markdown.split("\n").forEach((line, index) => {
    if (line.startsWith(ANSWER_PREFIX)) lines.push(index + 1);
  });
  return lines;
}

function valueAt(markdown: string, line: number): string {
  const raw = markdown.split("\n")[line - 1] ?? "";
  return raw.slice(ANSWER_PREFIX.length).replace(/\r$/, "").trim();
}

/** The nearest preceding non-empty line — the question this answer belongs to. */
function questionAt(markdown: string, line: number): string {
  const lines = markdown.split("\n");
  for (let i = line - 2; i >= 0; i -= 1) {
    const text = (lines[i] ?? "").trim();
    if (text !== "" && !text.startsWith(ANSWER_PREFIX)) return text.replace(/^#+\s*/, "");
  }
  return "";
}

/** D2's error table. Every identifier the server can send has a line here. */
const GATE_MESSAGE: Readonly<Record<AnswerError, string>> = {
  "read-only-mode": "モブ公開中は記入できません（ドライバーが本線で記入）",
  "not-a-questions-file": "このファイルは編集できません",
  "outside-record": "記録ディレクトリ外のファイルは編集できません",
  "not-an-answer-line": "この行は編集できません",
  "write-verification-failed": "保存を中止しました（ファイルは変更されていません）",
};

interface Feedback {
  text: string;
  tone: "ok" | "warn" | "error";
  /** Only the default branch offers a retry — a gate rejection will not change. */
  retry: boolean;
}

function feedbackFor(result: SaveResult): Feedback {
  switch (result.kind) {
    case "saved":
      return result.verified
        ? { text: "保存しました", tone: "ok", retry: false }
        : // S-AV-5: the mismatch is reported, the differing content is not.
          { text: "保存内容が想定と異なります", tone: "warn", retry: false };
    case "rejected":
      return { text: GATE_MESSAGE[result.error], tone: "error", retry: false };
    default:
      return { text: `保存できませんでした（${result.reason}）`, tone: "error", retry: true };
  }
}

/**
 * The explicit-commit control plus its result line — inseparable from the field
 * above it, hence a subcomponent here rather than a file of its own.
 */
function SaveBar({
  busy,
  feedback,
  onSave,
}: {
  busy: boolean;
  feedback: Feedback | null;
  onSave: () => void;
}): ReactNode {
  return (
    <div className="answer__bar">
      <button type="button" className="button" onClick={onSave} disabled={busy}>
        {busy ? "保存中…" : "保存"}
      </button>
      {/* One live region per field: a screen reader hears the result of the
          save it just triggered, not a page-level summary. */}
      <span className="answer__result" role="status" data-tone={feedback?.tone}>
        {feedback === null ? "" : feedback.text}
      </span>
      {feedback?.retry === true ? (
        <button type="button" className="button" onClick={onSave} disabled={busy}>
          再試行
        </button>
      ) : null}
    </div>
  );
}

function AnswerField({
  path,
  line,
  markdown,
  onSaved,
}: {
  path: string;
  line: number;
  markdown: string;
  onSaved: (markdown: string) => void;
}): ReactNode {
  const fieldId = useId();
  const [value, setValue] = useState(() => valueAt(markdown, line));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const save = (): void => {
    setBusy(true);
    setFeedback(null);
    void saveAnswer({ file: path, line, value }, markdown).then((result) => {
      setBusy(false);
      setFeedback(feedbackFor(result));
      if (result.kind === "saved") onSaved(result.markdown);
    });
  };

  return (
    <div className="answer__field">
      <label className="answer__label" htmlFor={fieldId}>
        {line} 行目の回答
        {questionAt(markdown, line) === "" ? "" : `: ${questionAt(markdown, line)}`}
      </label>
      <input
        id={fieldId}
        className="answer__input"
        type="text"
        value={value}
        disabled={busy}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      <SaveBar busy={busy} feedback={feedback} onSave={save} />
    </div>
  );
}

export function AnswerEditor({
  path,
  answerLines,
  markdown,
  hostMode,
  onSaved,
}: AnswerEditorProps): ReactNode {
  // S-AV-2: no element, no CSS, no disabled input — nothing.
  if (hostMode || answerLines.length === 0) return null;

  return (
    <section className="answer" aria-labelledby="answer-heading" data-testid="answer-editor">
      <h3 id="answer-heading" className="answer__heading">
        回答の記入
      </h3>
      {answerLines.map((line) => (
        <AnswerField key={line} path={path} line={line} markdown={markdown} onSaved={onSaved} />
      ))}
    </section>
  );
}
