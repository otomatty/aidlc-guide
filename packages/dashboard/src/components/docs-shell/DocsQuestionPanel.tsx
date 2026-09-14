import type { DocsQaCitation, DocsQaJob, DocsQaTool } from "@aidlc-guide/shared-types";
import { ArrowUpIcon, BookOpenIcon, SquareIcon } from "lucide-react";
import { type ReactNode, Suspense, useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownSurface } from "../../viewer/lazy-markdown.ts";
import { Skeleton } from "../atoms.tsx";
import { type DocsQaState, isRunning } from "./useDocsQa.ts";

const TOOL_LABELS: Record<DocsQaTool, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  copilot: "GitHub Copilot",
};

const PHASE_LABELS = {
  searching: "関連する文書を検索しています…",
  reading: "参照する箇所を確認しています…",
  answering: "文書をもとに回答を作成しています…",
  completed: "回答が完了しました",
  cancelled: "回答を停止しました",
  error: "回答を作成できませんでした",
};

function AnswerText({
  turn,
  onCitation,
}: {
  turn: DocsQaJob;
  onCitation: (citation: DocsQaCitation) => void;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const markdown = turn.answer.replace(/\[(\d+)\](?!\()/g, (original, id: string) =>
    turn.citations.some((citation) => citation.id === id)
      ? `[${id}](#docs-citation-${id})`
      : original,
  );
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const click = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const interactive = event.target.closest("a, button");
      if (!interactive || !element.contains(interactive)) return;
      // Model-produced file references are unverified too; only issued citations may navigate.
      event.preventDefault();
      event.stopPropagation();
      const id = interactive.getAttribute("href")?.match(/^#docs-citation-(\d+)$/)?.[1];
      const citation = turn.citations.find((candidate) => candidate.id === id);
      if (citation) onCitation(citation);
    };
    element.addEventListener("click", click, true);
    return () => element.removeEventListener("click", click, true);
  }, [turn.citations, onCitation]);
  return (
    <div ref={ref}>
      <Suspense fallback={<Skeleton lines={3} label="回答" />}>
        <MarkdownSurface markdown={markdown} editable={null} />
      </Suspense>
    </div>
  );
}

export function DocsQuestionPanel({
  qa,
  onCitation,
  hostMode,
}: {
  qa: DocsQaState;
  onCitation: (citation: DocsQaCitation, turn: DocsQaJob) => void;
  hostMode: boolean;
}): ReactNode {
  const selectedTool = qa.tools?.find((tool) => tool.tool === qa.tool);
  const canAsk = !hostMode && selectedTool?.available === true;
  return (
    <section
      className="flex min-w-0 flex-col gap-5"
      aria-labelledby="docs-question-title"
      data-testid="docs-question-panel"
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="docs-question-title">ドキュメントについて質問する</h2>
          </CardTitle>
          <CardDescription>
            内蔵ドキュメントをもとに回答します。回答の参照番号から、根拠となる箇所を開けます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void qa.submit();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="docs-question">
                  {qa.turns.length ? "続けて質問する" : "質問"}
                </FieldLabel>
                {qa.target ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">この文書: {qa.target.path}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => qa.setTarget(undefined)}
                    >
                      すべての文書を対象にする
                    </Button>
                  </div>
                ) : null}
                <Textarea
                  id="docs-question"
                  value={qa.draft}
                  onChange={(event) => qa.setDraft(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="例: Cursor で AI-DLC を始めるには？"
                  aria-describedby="docs-question-help"
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing &&
                      (event.ctrlKey || event.metaKey) &&
                      canAsk &&
                      !qa.busy
                    ) {
                      event.preventDefault();
                      void qa.submit();
                    }
                  }}
                />
                <FieldDescription id="docs-question-help">
                  質問と関連する文書の抜粋を、選んだツールへ送信します。ツール側の利用枠を使用します。
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="docs-question-tool">回答に使うツール</FieldLabel>
                <NativeSelect
                  id="docs-question-tool"
                  value={qa.tool}
                  disabled={qa.busy}
                  onChange={(event) => {
                    if (
                      event.target.value === "claude" ||
                      event.target.value === "cursor" ||
                      event.target.value === "copilot"
                    )
                      qa.setTool(event.target.value);
                  }}
                >
                  <NativeSelectOption value="claude">Claude Code</NativeSelectOption>
                  <NativeSelectOption value="cursor">Cursor</NativeSelectOption>
                  <NativeSelectOption value="copilot">GitHub Copilot</NativeSelectOption>
                </NativeSelect>
                <FieldDescription>
                  {hostMode
                    ? "共有モードでは利用できません。ローカルで開いてください。"
                    : qa.tools === null
                      ? "ツールの利用状況を確認しています…"
                      : (selectedTool?.detail ??
                        (selectedTool?.available
                          ? "利用できます"
                          : "ツールを利用できません。インストールとログインを確認してください。"))}
                </FieldDescription>
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={qa.refresh}>
                  接続を再確認
                </Button>
                {qa.busy ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void qa.cancel();
                    }}
                  >
                    <SquareIcon data-icon="inline-start" />
                    回答を停止
                  </Button>
                ) : (
                  <Button type="submit" disabled={!canAsk || !qa.draft.trim()}>
                    <ArrowUpIcon data-icon="inline-start" />
                    質問する
                  </Button>
                )}
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {qa.error ? (
        <Alert variant="destructive">
          <AlertTitle>質問機能を確認してください</AlertTitle>
          <AlertDescription>{qa.error}</AlertDescription>
        </Alert>
      ) : null}
      {qa.submitting ? (
        <p role="status" className="text-sm text-muted-foreground">
          質問を送信しています…
        </p>
      ) : null}
      {qa.turns.map((turn, index) => (
        <Card key={turn.id} id={`docs-answer-${turn.id}`} data-testid="docs-answer" tabIndex={-1}>
          <CardHeader>
            <CardDescription>
              質問 {index + 1} · {TOOL_LABELS[turn.tool]}
            </CardDescription>
            <CardTitle>
              <h3 className="whitespace-pre-wrap break-words">{turn.question}</h3>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {PHASE_LABELS[turn.phase]}
            </p>
            {turn.answer ? (
              <AnswerText turn={turn} onCitation={(citation) => onCitation(citation, turn)} />
            ) : null}
            {turn.error ? (
              <Alert variant="destructive">
                <AlertDescription>{turn.error}</AlertDescription>
              </Alert>
            ) : null}
            {turn.citations.length > 0 ? (
              <section className="flex flex-col gap-2" aria-label="参照したドキュメント">
                <h4 className="text-sm font-medium">
                  {turn.sourcesKind === "related" ? "関連するドキュメント" : "参照したドキュメント"}
                </h4>
                <ol className="flex flex-col gap-2">
                  {turn.citations.map((citation) => (
                    <li key={citation.id} className="min-w-0">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                        onClick={() => onCitation(citation, turn)}
                        aria-label={`参照 ${citation.id}: ${citation.title}`}
                      >
                        <BookOpenIcon data-icon="inline-start" />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span>
                            [{citation.id}] {citation.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {citation.headings.join(" › ")} · {citation.target.locale.toUpperCase()}{" "}
                            · {citation.version}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {!isRunning(turn) ? (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={qa.busy}
                  onClick={() => {
                    qa.setDraft(turn.question);
                    document.getElementById("docs-question")?.focus();
                  }}
                >
                  この質問を編集する
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
