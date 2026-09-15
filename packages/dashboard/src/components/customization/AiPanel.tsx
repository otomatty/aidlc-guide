import type {
  CustomizationDraft,
  CustomizationItem,
  CustomizationProposal,
} from "@aidlc-guide/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { aiRunning, type CustomizationAiState } from "./useCustomizationAi";

const LABELS = {
  reserved: "生成を準備しています",
  running: "提案を作成しています",
  stopping: "停止を確認しています",
  completed: "生成完了",
  cancelled: "停止済み",
  error: "生成できませんでした",
  interrupted: "実行が中断されました",
};

function ProposalView({
  proposal,
  items,
  onAdopt,
  onShow,
  disabled,
}: {
  proposal: CustomizationProposal;
  items: CustomizationItem[];
  onAdopt: () => void;
  onShow: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p>{proposal.summary}</p>
      {proposal.changes.map((change) => {
        const id = change.operation === "remove" ? change.itemId : change.item.id;
        const before = items.find((item) => item.id === id);
        return (
          <details key={id}>
            <summary>
              {change.operation === "create"
                ? "追加"
                : change.operation === "remove"
                  ? "削除"
                  : "変更"}{" "}
              · {change.operation === "remove" ? (before?.title ?? id) : change.item.title}
            </summary>
            <div className="flex flex-col gap-2 py-2">
              <p>現在の下書き</p>
              <pre className="whitespace-pre-wrap break-words text-xs">
                {before?.content ?? "（項目なし）"}
              </pre>
              <p>提案</p>
              <pre className="whitespace-pre-wrap break-words text-xs">
                {change.operation === "remove" ? "（削除）" : change.item.content}
              </pre>
              {before ? (
                <Button variant="ghost" size="sm" onClick={() => onShow(id)}>
                  編集画面で見る
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">取り込むと編集画面に追加されます。</p>
              )}
            </div>
          </details>
        );
      })}
      <Button disabled={disabled} onClick={onAdopt}>
        下書きに取り込む
      </Button>
    </div>
  );
}

export function AiPanel({
  ai,
  draft,
  items,
  selectedId,
  configurationRevision,
  dirty,
  busy,
  onAdopt,
  onShow,
}: {
  ai: CustomizationAiState;
  draft: CustomizationDraft | null;
  items: CustomizationItem[];
  selectedId: string | null;
  configurationRevision?: string;
  dirty: boolean;
  busy: boolean;
  onAdopt: (proposal: CustomizationProposal) => void;
  onShow: (id: string) => void;
}) {
  const materials = [
    ...items
      .filter((item) => item.kind === "knowledge")
      .map((item) => ({ id: item.id, title: item.title })),
    ...ai.materials,
  ];
  return (
    <section aria-label="カスタマイズAIチャット" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">AIチャット</h2>
        <Button variant="ghost" size="sm" onClick={ai.refresh}>
          ツール・会話を再確認
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        現在の設定と保存した下書きをもとに相談できます。提案は確認してから取り込みます。
      </p>
      {ai.error ? (
        <Alert variant="destructive">
          <AlertDescription>{ai.error}</AlertDescription>
        </Alert>
      ) : null}
      <MessageScrollerProvider>
        <MessageScroller className="h-[min(55dvh,32rem)]">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {ai.jobs.map((job) => (
                <MessageScrollerItem key={job.id} messageId={job.id}>
                  <div className="flex flex-col gap-4">
                    <Message align="end">
                      <MessageContent>
                        <MessageHeader>あなた</MessageHeader>
                        <Bubble variant="secondary" align="end">
                          <BubbleContent>
                            <p className="whitespace-pre-wrap">{job.message}</p>
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                    <Message>
                      <MessageContent>
                        <MessageHeader>
                          <Badge variant="outline">{LABELS[job.phase]}</Badge>
                        </MessageHeader>
                        <Bubble variant="ghost">
                          <BubbleContent>
                            {job.answer ? (
                              <p className="whitespace-pre-wrap">{job.answer}</p>
                            ) : null}
                            {job.error ? <p role="alert">{job.error}</p> : null}
                            {job.contextTruncated ? (
                              <p>長い資料の一部を省略して参照しました。</p>
                            ) : null}
                            {job.proposal && job.phase === "completed" ? (
                              <>
                                <ProposalView
                                  proposal={job.proposal}
                                  items={items}
                                  disabled={
                                    dirty ||
                                    busy ||
                                    draft?.id !== job.proposal.draftId ||
                                    draft?.revision !== job.proposal.draftRevision ||
                                    Boolean(
                                      configurationRevision &&
                                        configurationRevision !==
                                          job.proposal.configurationRevision,
                                    )
                                  }
                                  onAdopt={() => {
                                    if (job.proposal) onAdopt(job.proposal);
                                  }}
                                  onShow={onShow}
                                />
                                {draft?.revision !== job.proposal.draftRevision ? (
                                  <p className="text-sm text-muted-foreground">
                                    この提案の生成後に下書きが変わっています。採用済みの場合も、再取り込みはできません。
                                  </p>
                                ) : null}
                              </>
                            ) : null}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </div>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="customization-ai-tool">利用するAIツール</FieldLabel>
          <NativeSelect
            id="customization-ai-tool"
            value={ai.tool}
            disabled={ai.submitting || Boolean(ai.active) || ai.uncertain}
            onChange={(event) => ai.setTool(event.target.value as typeof ai.tool)}
          >
            {(["claude", "cursor", "copilot"] as const).map((tool) => (
              <NativeSelectOption key={tool} value={tool}>
                {ai.tools.find((value) => value.tool === tool)?.label ??
                  { claude: "Claude Code", cursor: "Cursor", copilot: "GitHub Copilot" }[tool]}
                {ai.tools.find((value) => value.tool === tool)?.available ? "" : "（利用不可）"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {materials.length ? (
          <details>
            <summary>参照する資料を選ぶ（{ai.materialIds.length}/8件）</summary>
            <FieldSet className="py-3">
              <FieldLegend className="sr-only">参照資料</FieldLegend>
              {materials.map((item) => (
                <Field key={item.id} orientation="horizontal">
                  <Checkbox
                    id={`ai-material-${item.id}`}
                    checked={ai.materialIds.includes(item.id)}
                    disabled={
                      ai.uncertain ||
                      (ai.materialIds.length >= 8 && !ai.materialIds.includes(item.id))
                    }
                    onCheckedChange={(checked) =>
                      ai.setMaterialIds(
                        checked
                          ? [...ai.materialIds, item.id]
                          : ai.materialIds.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`ai-material-${item.id}`}>{item.title}</FieldLabel>
                </Field>
              ))}
            </FieldSet>
          </details>
        ) : null}
        <Field>
          <FieldLabel htmlFor="customization-ai-message">相談・変更の依頼</FieldLabel>
          <Textarea
            id="customization-ai-message"
            rows={4}
            maxLength={4000}
            value={ai.message}
            disabled={ai.uncertain}
            placeholder="例：この工程にセキュリティの確認を追加したい"
            onChange={(event) => ai.setMessage(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              busy ||
              ai.submitting ||
              Boolean(ai.active) ||
              (!ai.uncertain &&
                (!ai.message.trim() || !ai.tools.find((tool) => tool.tool === ai.tool)?.available))
            }
            onClick={() => void ai.send(selectedId ? [selectedId] : [])}
          >
            {ai.uncertain ? "同じ依頼の受付を再確認" : "送信"}
          </Button>
          {ai.submitting || (ai.active && aiRunning(ai.active)) ? (
            <Button variant="outline" onClick={() => void ai.cancel()}>
              生成を停止
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </section>
  );
}
