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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFetchView } from "../hooks/useFetchView.ts";
import { fetchEffectiveness } from "../services/api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { AreaError, EmptyState, Skeleton } from "./atoms.tsx";
import { EffectivenessRow } from "./EffectivenessRow.tsx";
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
        evidence={
          totals.waits.count === 0
            ? coverage(0)
            : `${coverage(totals.waits.count)}。待機中 ${formatDuration(totals.waits.pendingMs)} は別集計。`
        }
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
        title="品質チェックの合格"
        value={totals.sensors.count === 0 ? "未記録" : `${totals.sensors.passed} 件`}
        detail="検証結果の証跡がある合格のみ"
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

function Filter({
  name,
  label,
  values,
  value,
  onChange,
}: {
  name: string;
  label: string;
  values: (string | null)[];
  value: string;
  onChange: (value: string) => void;
}): ReactNode {
  const options = [...new Set(values.map((item) => JSON.stringify(item)))].sort();
  return (
    <Field>
      <FieldLabel htmlFor={`effectiveness-${name}`}>{label}</FieldLabel>
      <NativeSelect
        id={`effectiveness-${name}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">すべて</NativeSelectOption>
        {options.map((item) => (
          <NativeSelectOption key={item} value={item}>
            {JSON.parse(item) ?? "未記録"}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function Comparison({
  payload,
  notes,
  scope,
  depth,
  setScope,
  setDepth,
}: {
  payload: EffectivenessPayload;
  notes: string[];
  scope: string;
  depth: string;
  setScope: (value: string) => void;
  setDepth: (value: string) => void;
}): ReactNode {
  const rows = payload.intents.filter(
    (row) =>
      (scope === "" || JSON.stringify(row.scope) === scope) &&
      (depth === "" || JSON.stringify(row.depth) === depth),
  );
  const warnings = [...new Set([...payload.warnings, ...notes])];
  return (
    <>
      <p className="text-sm text-muted-foreground">
        スペース {payload.space} の記録を比較します。停止や承認待ちを含む経過時間です。実労働時間や
        AI-DLC による削減効果を示す値ではありません。
      </p>
      <Card size="sm">
        <CardHeader>
          <CardTitle>比較する案件</CardTitle>
          <CardDescription>
            scope と depth をそろえて比較できます。案件の規模や難易度も確認してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="sm:flex-row">
            <Filter
              name="scope"
              label="Scope（対象範囲）"
              values={payload.intents.map((row) => row.scope)}
              value={scope}
              onChange={setScope}
            />
            <Filter
              name="depth"
              label="Depth（進め方の深さ）"
              values={payload.intents.map((row) => row.depth)}
              value={depth}
              onChange={setDepth}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <p className="text-sm" role="status">
            表示 {rows.length} / {payload.intents.length} 件
          </p>
        </CardFooter>
      </Card>
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
          <Card>
            <CardHeader>
              <CardTitle>案件ごとの記録</CardTitle>
              <CardDescription>
                「未記録」はデータ不足、「0」は記録上のゼロです。初回レビューがない案件は「対象なし」と表示します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>
                  横にスクロールして各指標を比較できます。品質チェックの失敗・省略・証跡不足、トークンの入力・出力・キャッシュは「記録の内訳」で確認できます。
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">案件 / 条件</TableHead>
                    <TableHead scope="col">完了 / 経過時間</TableHead>
                    <TableHead scope="col">承認待ち</TableHead>
                    <TableHead scope="col">差し戻し</TableHead>
                    <TableHead scope="col">初回合格率</TableHead>
                    <TableHead scope="col">品質チェック</TableHead>
                    <TableHead scope="col">トークン・推定費用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <EffectivenessRow key={row.dirName} row={row} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                費用は Claude の記録がある場合のみ表示する単価ベースの推定です。請求額や Cursor
                を含む全ツールの総費用ではありません。
              </p>
            </CardFooter>
          </Card>
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
      testId="effectiveness-panel"
      closeTestId="effectiveness-close"
      onClose={close}
      actions={
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
            setScope={setScope}
            setDepth={setDepth}
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
