import { Badge } from "@/components/ui/badge";

const badgeLayout = "h-auto min-h-5 max-w-full whitespace-normal break-all";

export type ModelLoadState = "ready" | "loading" | "error";

/** Shows missing usage only after a successful read, keeping transport failures distinct. */
export function StageModelLabel({
  stage,
  observed,
  hasReviewer = false,
  hasSupport = false,
  loadState = "ready",
  usageLoadState,
}: {
  stage: string;
  observed?: string[];
  hasReviewer?: boolean;
  hasSupport?: boolean;
  loadState?: ModelLoadState;
  /** 担当 badge only; withheld usage can fail independently of harness settings. */
  usageLoadState?: ModelLoadState;
}) {
  const usage = usageLoadState ?? loadState;
  const recorded = usage === "ready" && observed !== undefined && observed.length > 0;
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid={`stage-models-${stage}`}>
      <Badge
        variant="secondary"
        className={badgeLayout}
        title={
          usage === "loading"
            ? "モデル情報を読み込んでいます。"
            : usage === "error"
              ? "モデル情報を取得できません。使用記録の有無は確認できていません。"
              : recorded
                ? "このステージの使用記録です。再実行やレビューを含み、現在のモデルや担当別の割り当ては表しません。"
                : "使用記録がないため、デフォルトと表示しています。"
        }
      >
        担当:{" "}
        {usage === "loading"
          ? "読み込み中"
          : usage === "error"
            ? "取得できません"
            : recorded
              ? observed.join("、")
              : "デフォルト"}
      </Badge>
      {hasReviewer && loadState === "ready" ? (
        <Badge
          variant="outline"
          className={badgeLayout}
          title="レビュワー個別の使用記録がないため、デフォルトと表示しています。レビューは有効な場合に実行されます。"
        >
          レビュワー: デフォルト
        </Badge>
      ) : null}
      {hasSupport && loadState === "ready" ? (
        <Badge
          variant="outline"
          className={badgeLayout}
          title="補助エージェント個別の使用記録がないため、デフォルトと表示しています。"
        >
          補助: デフォルト
        </Badge>
      ) : null}
    </span>
  );
}
