import type { IntentEffectiveness } from "@aidlc-guide/shared-types";
import { type ReactNode, useId } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatEffectivenessDuration as formatDuration,
  formatRate,
  formatUsd,
} from "./effectiveness-summary.ts";

const MISSING = "未記録";

function statusLabel(status: string | null): string {
  if (status === null) return "状態不明";
  const labels: Record<string, string> = {
    completed: "完了",
    active: "進行中",
    "in-progress": "進行中",
    paused: "中断中",
    archived: "アーカイブ",
    abandoned: "中止",
    pending: "未着手",
  };
  return labels[status.toLowerCase()] ?? status;
}

/** Detailed evidence stays with its intent, below its summary metrics. */
function Evidence({ row }: { row: IntentEffectiveness }): ReactNode {
  const { approvalWait: wait, reviews, sensors, usage } = row;
  const humanInputs =
    row.humanTurns ??
    (row.warnings.includes("human turns without workflow attribution excluded")
      ? "判別不可（実行先未記録）"
      : MISSING);
  return (
    <details className="w-full min-w-0 whitespace-normal text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        記録の内訳{row.warnings.length > 0 ? `・注意 ${row.warnings.length} 件` : ""}
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-muted-foreground [overflow-wrap:anywhere]">
        <p>{row.name}</p>
        <p>
          開始: {row.startedAt ?? MISSING}
          <br />
          完了: {row.completedAt ?? MISSING}
        </p>
        <p>
          監査イベント: {row.auditEventCount === null ? MISSING : `${row.auditEventCount} 件`}
          。人の入力: {humanInputs}。修正: {row.revisions ?? MISSING}。
        </p>
        {wait === null ? null : (
          <p>
            承認待ち: 確定 {wait.completedIntervals} 区間、待機中 {wait.pendingIntervals}{" "}
            区間、集計除外 {wait.excludedIntervals} 区間。
          </p>
        )}
        {reviews === null ? null : (
          <p>
            レビュー完了 {reviews.completed} 件。READY {reviews.ready} 件、NOT-READY{" "}
            {reviews.notReady} 件。初回の対応不明 {reviews.unmatched} 件。
          </p>
        )}
        {sensors === null ? null : (
          <p>
            案件内の品質チェック（通常・単独実行の合計）: 合格証跡あり {sensors.verifiedPassed}{" "}
            件、失敗 {sensors.failed} 件、省略 {sensors.skipped} 件、証跡不足 {sensors.incomplete}{" "}
            件。{sensors.findings === null ? "指摘数は未記録" : `指摘 ${sensors.findings} 件`}。
            省略と証跡不足は合格に含めません。
          </p>
        )}
        {usage === null ? (
          <p>トークン・費用の記録はありません。</p>
        ) : (
          <>
            <p>
              Claude の記録。入力 {usage.inputTokens.toLocaleString()}、出力{" "}
              {usage.outputTokens.toLocaleString()}、キャッシュ読取{" "}
              {usage.cacheReadTokens.toLocaleString()}、キャッシュ書込{" "}
              {usage.cacheWriteTokens.toLocaleString()} トークン。
            </p>
            <p>
              費用は単価に基づく推定です。請求額とは一致しません。
              {usage.partial ? "利用量の記録が一部不足しています。" : ""}
            </p>
            {usage.unknownModels.length > 0 ? (
              <p>単価不明のモデル: {usage.unknownModels.join("、")}</p>
            ) : null}
          </>
        )}
        {row.warnings.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {[...new Set(row.warnings)].map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm tabular-nums">{children}</dd>
    </div>
  );
}

export function EffectivenessCard({ row }: { row: IntentEffectiveness }): ReactNode {
  const { approvalWait: wait, reviews, sensors, usage } = row;
  const finished = row.completedAt !== null || row.status?.toLowerCase() === "completed";
  const headingId = useId();
  return (
    <Card
      role="article"
      aria-labelledby={headingId}
      data-testid={`effectiveness-card-${row.dirName}`}
      className="min-w-0 [overflow-wrap:anywhere]"
    >
      <CardHeader>
        <CardTitle>
          <h3 id={headingId}>{row.dirName}</h3>
        </CardTitle>
        <CardDescription className="line-clamp-2" title={row.name}>
          {row.name}
        </CardDescription>
        <div className="mt-2 flex min-w-0 flex-wrap gap-1">
          <Badge variant="outline" className="max-w-full whitespace-normal">
            {row.scope ?? "scope 不明"}
          </Badge>
          <Badge variant="outline" className="max-w-full whitespace-normal">
            {row.depth ?? "depth 不明"}
          </Badge>
          <Badge variant="secondary" className="max-w-full whitespace-normal">
            {statusLabel(row.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-x-4 gap-y-5">
          <Metric label="完了 / 経過時間">
            {row.completionMs !== null ? (
              <>
                {formatDuration(row.completionMs)}
                <div className="text-xs text-muted-foreground">完了まで</div>
              </>
            ) : !finished && row.elapsedMs !== null ? (
              <>
                {formatDuration(row.elapsedMs)}
                <div className="text-xs text-muted-foreground">進行中の経過</div>
              </>
            ) : (
              MISSING
            )}
          </Metric>
          <Metric label="承認待ち">
            {wait === null || (wait.completedMs === null && wait.pendingMs === null) ? (
              MISSING
            ) : (
              <>
                {wait.completedMs !== null ? (
                  <>
                    {formatDuration(wait.completedMs)}
                    <div className="text-xs text-muted-foreground">確定分</div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">確定分は未記録</div>
                )}
                {wait.pendingMs !== null ? (
                  <div className="text-xs text-muted-foreground">
                    待機中 {formatDuration(wait.pendingMs)}
                  </div>
                ) : null}
              </>
            )}
          </Metric>
          <Metric label="差し戻し">
            {row.rejections === null ? MISSING : `${row.rejections} 件`}
          </Metric>
          <Metric label="初回合格率">
            {reviews === null ? (
              MISSING
            ) : (
              <>
                {formatRate(reviews.firstPassReady, reviews.firstPassTotal)}
                <div className="text-xs text-muted-foreground">
                  {reviews.firstPassReady} / {reviews.firstPassTotal} 初回レビュー
                </div>
              </>
            )}
          </Metric>
          <Metric label="品質チェック">
            {sensors === null ? (
              MISSING
            ) : (
              <>
                {sensors.verifiedPassed} 件 合格
                <div className="text-xs text-muted-foreground">
                  失敗 {sensors.failed} / 省略 {sensors.skipped}
                  <br />
                  証跡不足 {sensors.incomplete}
                </div>
              </>
            )}
          </Metric>
          <Metric label="トークン・推定費用">
            {usage === null ? (
              MISSING
            ) : (
              <>
                {formatUsd(usage.estimatedUsd)}
                <div className="text-xs text-muted-foreground">
                  {usage.partial ? "一部の記録・推定" : "推定"}
                  <br />入 {usage.inputTokens.toLocaleString()} / 出{" "}
                  {usage.outputTokens.toLocaleString()}
                </div>
              </>
            )}
          </Metric>
        </dl>
      </CardContent>
      <CardFooter>
        <Evidence row={row} />
      </CardFooter>
    </Card>
  );
}
