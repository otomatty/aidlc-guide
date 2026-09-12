import type { EffectivenessPayload, IntentEffectiveness } from "@aidlc-guide/shared-types";
import { RefreshCwIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFetchView } from "../hooks/useFetchView.ts";
import { fetchEffectiveness } from "../services/api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { AreaError, EmptyState, Skeleton } from "./atoms.tsx";
import { EffectivenessCard } from "./EffectivenessCard.tsx";
import { EffectivenessFilters } from "./EffectivenessFilters.tsx";
import {
  formatEffectivenessDuration as formatDuration,
  formatRate,
  formatUsd,
  summarizeEffectiveness,
} from "./effectiveness-summary.ts";
import { PanelBody, PanelShell } from "./PanelShell.tsx";

function MetricCard({
  title,
  value,
  detail,
  evidence,
}: {
  title: string;
  value: string;
  detail: string;
  evidence: string;
}): ReactNode {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-medium tabular-nums">{value}</p>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">{evidence}</p>
      </CardFooter>
    </Card>
  );
}

function Summary({ rows }: { rows: IntentEffectiveness[] }): ReactNode {
  const totals = summarizeEffectiveness(rows);
  const coverage = (count: number): string => `記録あり ${count} / ${rows.length} 件`;
  return (
    <section
      aria-label="比較対象の集計"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <MetricCard
        title="完了までの時間"
        value={
          totals.completed.median === null ? "未記録" : formatDuration(totals.completed.median)
        }
        detail="開始から完了までの中央値"
        evidence={`完了の記録あり ${totals.completed.count} / ${rows.length} 件。進行中は除外。`}
      />
      <MetricCard
        title="承認待ち"
        value={totals.waits.count === 0 ? "未記録" : formatDuration(totals.waits.completedMs)}
        detail="終了した待機区間の合計"
        evidence={`${coverage(totals.waits.count)}。${
          totals.waits.pendingCount > 0
            ? `待機中 ${formatDuration(totals.waits.pendingMs)} は別集計。`
            : "計測中の待機なし。"
        }`}
      />
      <MetricCard
        title="差し戻し"
        value={totals.rejections.count === 0 ? "未記録" : `${totals.rejections.total} 件`}
        detail="承認ゲートで差し戻された回数"
        evidence={coverage(totals.rejections.count)}
      />
      <MetricCard
        title="レビュー初回合格率"
        value={
          totals.reviews.count === 0
            ? "未記録"
            : formatRate(totals.reviews.ready, totals.reviews.total)
        }
        detail="最初のレビューで READY となった割合"
        evidence={
          totals.reviews.count === 0
            ? coverage(0)
            : `${totals.reviews.ready} / ${totals.reviews.total} 初回レビュー。${coverage(totals.reviews.count)}。`
        }
      />
      <MetricCard
        title="案件内の品質チェック"
        value={totals.sensors.count === 0 ? "未記録" : `${totals.sensors.passed} 件`}
        detail="通常・単独実行を含む、検証結果の証跡がある合格"
        evidence={
          totals.sensors.count === 0
            ? coverage(0)
            : `${coverage(totals.sensors.count)}。失敗 ${totals.sensors.failed}、省略 ${totals.sensors.skipped}、証跡不足 ${totals.sensors.incomplete}。`
        }
      />
      <MetricCard
        title="トークン・推定費用"
        value={totals.usage.count === 0 ? "未記録" : formatUsd(totals.usage.usd)}
        detail="Claude の利用記録から算定できた費用の合計"
        evidence={`費用の算定可 ${totals.usage.priced} / ${rows.length} 件。${totals.usage.partial ? "一部の記録による推定。" : ""}トークン内訳は各案件で確認。`}
      />
    </section>
  );
}

function Comparison({
  payload,
  notes,
  scope,
  depth,
}: {
  payload: EffectivenessPayload;
  notes: string[];
  scope: string;
  depth: string;
}): ReactNode {
  const rows = payload.intents.filter(
    (row) =>
      (scope === "" || JSON.stringify(row.scope) === scope) &&
      (depth === "" || JSON.stringify(row.depth) === depth),
  );
  const warnings = [...new Set([...payload.warnings, ...notes])];
  return (
    <>
      <p className="text-sm text-muted-foreground" role="status">
        表示 {rows.length} / {payload.intents.length} 件
      </p>
      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>一部の記録を集計できません</AlertTitle>
          <AlertDescription>
            <details>
              <summary className="cursor-pointer">集計の注意 {warnings.length} 件</summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning} className="[overflow-wrap:anywhere]">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          </AlertDescription>
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          title={
            payload.intents.length === 0
              ? "計測対象の案件がありません"
              : "条件に合う案件がありません"
          }
          hint={
            payload.intents.length === 0
              ? "このスペースにはインテントがありません。"
              : "scope または depth の絞り込みを変更してください。"
          }
          showCreateHint={false}
        />
      ) : (
        <>
          <Summary rows={rows} />
          <section className="grid min-w-0 gap-4" aria-labelledby="effectiveness-records-heading">
            <div className="grid gap-1">
              <h2 id="effectiveness-records-heading" className="text-base font-medium">
                案件ごとの記録
              </h2>
              <p className="text-sm text-muted-foreground">
                「未記録」はデータ不足、「0」は記録上のゼロです。初回レビューがない案件も「未記録」と表示します。
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))] items-start gap-4">
              {rows.map((row) => (
                <EffectivenessCard key={row.dirName} row={row} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              費用は Claude の記録がある場合のみ表示する単価ベースの推定です。請求額や Cursor
              を含む全ツールの総費用ではありません。
            </p>
          </section>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        集計時点:{" "}
        <time dateTime={payload.generatedAt}>
          {new Date(payload.generatedAt).toLocaleString("ja-JP")}
        </time>
      </p>
    </>
  );
}

function EffectivenessContent({ space }: { space: string | null }): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  const [revision, setRevision] = useState(0);
  const [scope, setScope] = useState("");
  const [depth, setDepth] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const view = useFetchView(fetchEffectiveness, [
    space,
    revision,
    state.live.lastChangeAt,
    state.live.connected,
  ]);
  const result = view === null ? null : viewValue(view);
  const mismatched = result !== null && space !== null && result.space !== space;
  const refresh = (): void => setRevision((value) => value + 1);
  const close = (): void => dispatch({ type: "effectiveness", open: false });
  return (
    <PanelShell
      headingId="effectiveness-heading"
      title="効果測定"
      headingFont="body"
      testId="effectiveness-panel"
      returnFocusSelector='[data-testid="header-nav-effectiveness"], [data-testid="header-menu-trigger"]'
      onClose={close}
      onEscapeKeyDown={() => {
        if (!filtersOpen) close();
      }}
      actions={
        <>
          <EffectivenessFilters
            rows={result?.intents ?? []}
            scope={scope}
            depth={depth}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            disabled={result === null || mismatched}
            onApply={(nextScope, nextDepth) => {
              setScope(nextScope);
              setDepth(nextDepth);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={view?.kind === "loading"}
            data-testid="effectiveness-refresh"
          >
            <RefreshCwIcon data-icon="inline-start" />
            更新
          </Button>
        </>
      }
    >
      <PanelBody>
        {view === null || view.kind === "loading" ? (
          <Skeleton lines={6} label="効果測定" />
        ) : view.kind === "error" ? (
          <AreaError detail={view.detail} onRetry={refresh} />
        ) : view.kind === "empty" ? (
          <EmptyState title="計測データがありません" hint={view.hint} showCreateHint={false} />
        ) : mismatched ? (
          <AreaError
            detail="スペースが変更されました。画面を更新してから再度開いてください。"
            onRetry={refresh}
          />
        ) : result === null ? null : (
          <Comparison
            payload={result}
            notes={view.kind === "partial" ? view.notes : []}
            scope={scope}
            depth={depth}
          />
        )}
      </PanelBody>
    </PanelShell>
  );
}

export default function EffectivenessPanel(): ReactNode {
  const state = useAppState();
  const space = viewValue(state.intents)?.space ?? null;
  // Remount when the space changes: no stale data, filters, or requests cross spaces.
  return state.effectivenessOpen ? <EffectivenessContent key={space} space={space} /> : null;
}
