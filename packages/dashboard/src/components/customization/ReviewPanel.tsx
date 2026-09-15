import type {
  CustomizationDiagnostic,
  CustomizationDraft,
  CustomizationItem,
  CustomizationOperation,
  CustomizationPlan,
} from "@aidlc-guide/shared-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Diagnostics({
  diagnostics,
  onShow,
}: {
  diagnostics: CustomizationDiagnostic[];
  onShow: (id: string) => void;
}) {
  if (!diagnostics.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="設定の確認結果">
      {diagnostics.map((entry) => (
        <Alert
          key={`${entry.code}-${entry.itemId}-${entry.field}-${entry.message}`}
          variant={entry.severity === "error" ? "destructive" : "default"}
        >
          <AlertTitle>{entry.severity === "error" ? "修正が必要" : "確認事項"}</AlertTitle>
          <AlertDescription>
            <p>{entry.message}</p>
            {entry.itemId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (entry.itemId) onShow(entry.itemId);
                }}
              >
                該当項目を開く
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ))}
    </section>
  );
}

export function ReviewPanel({
  plan,
  draft,
  dirty,
  operation,
  busy,
  error,
  onClose,
  onApply,
  onShow,
}: {
  plan: CustomizationPlan | null;
  draft: CustomizationDraft | null;
  dirty: boolean;
  operation: CustomizationOperation | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onApply: () => void;
  onShow: (id: string) => void;
}) {
  const stale = dirty || draft?.id !== plan?.draftId || draft?.revision !== plan?.draftRevision;
  return (
    <Dialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>変更を確認</DialogTitle>
          <DialogDescription>
            適用される原本と生成ファイルの差分を確認します。適用はこの画面から手動で行います。
          </DialogDescription>
        </DialogHeader>
        {plan ? (
          <div className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {stale && operation?.status !== "completed" ? (
              <Alert>
                <AlertDescription>
                  確認を始めた後に下書きが変わりました。閉じて、もう一度「変更を確認」を開いてください。
                </AlertDescription>
              </Alert>
            ) : null}
            <Diagnostics diagnostics={plan.diagnostics} onShow={onShow} />
            <p>
              {plan.files.length === 0 &&
              plan.diagnostics.some((entry) => entry.severity === "error")
                ? "差分を算出できませんでした。上の確認結果をご覧ください。"
                : `${plan.files.length}ファイルを変更します。`}
            </p>
            {plan.files.map((file) => (
              <details key={file.relativePath} open={!file.generated}>
                <summary>
                  <Badge variant="outline">{file.generated ? "生成物" : "原本"}</Badge>{" "}
                  {file.relativePath}
                </summary>
                <div className="grid min-w-0 gap-3 py-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">変更前</h3>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs">
                      {file.before ??
                        (file.beforeHash ? "（バイナリまたは本文を省略）" : "（ファイルなし）")}
                    </pre>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium">変更後</h3>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 text-xs">
                      {file.after ?? (file.afterHash ? "（バイナリまたは本文を省略）" : "（削除）")}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
            {!plan.canApply ? (
              <Alert>
                <AlertDescription>
                  現在は適用できません。上の診断を確認してください。下書きの編集と保存は続けられます。
                </AlertDescription>
              </Alert>
            ) : null}
            {operation ? (
              <p role="status">
                {operation.message ??
                  (operation.status === "completed"
                    ? "適用が完了しました。"
                    : operation.status === "failed"
                      ? (operation.error?.message ?? "適用できませんでした。")
                      : "適用結果を確認しています…")}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                編集へ戻る
              </Button>
              <Button
                disabled={
                  stale ||
                  busy ||
                  !plan.canApply ||
                  plan.files.length === 0 ||
                  operation?.status === "running" ||
                  operation?.status === "completed"
                }
                onClick={onApply}
              >
                {busy ? "処理中…" : "適用"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function itemChanges(base: CustomizationItem[], items: CustomizationItem[]): string[] {
  const before = new Map(base.map((item) => [item.id, item]));
  const after = new Map(items.map((item) => [item.id, item]));
  return [...new Set([...before.keys(), ...after.keys()])].filter(
    (id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)),
  );
}
