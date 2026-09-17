import { Badge } from "@/components/ui/badge";

const badgeLayout = "h-auto min-h-5 max-w-full whitespace-normal break-all";

export function StageModelLabel({
  stage,
  observed,
  hasReviewer = false,
  hasSupport = false,
}: {
  stage: string;
  observed?: string[];
  hasReviewer?: boolean;
  hasSupport?: boolean;
}) {
  const recorded = observed !== undefined && observed.length > 0;
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid={`stage-models-${stage}`}>
      <Badge
        variant="secondary"
        className={badgeLayout}
        title={
          recorded
            ? "このステージの使用記録です。再実行やレビューを含み、現在のモデルや担当別の割り当ては表しません。"
            : "使用記録がないため、デフォルトと表示しています。"
        }
      >
        担当: {recorded ? observed.join("、") : "デフォルト"}
      </Badge>
      {hasReviewer ? (
        <Badge
          variant="outline"
          className={badgeLayout}
          title="レビュワー個別の使用記録がないため、デフォルトと表示しています。レビューは有効な場合に実行されます。"
        >
          レビュワー: デフォルト
        </Badge>
      ) : null}
      {hasSupport ? (
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
