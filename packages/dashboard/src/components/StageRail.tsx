import {
  formatTimingDuration,
  type Phase,
  type StageInfo,
  stageViewMatches,
  type TimingsPayload,
  type WorkflowModel,
} from "@aidlc-guide/shared-types";
import { type KeyboardEvent, memo, type ReactNode, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { StageModelLabel } from "./StageModelLabel.tsx";
import { StatusChip } from "./StatusChip.tsx";

/** The rail's own chrome, shared by the loaded and not-yet-loaded wrappers. */
const RAIL = "border-b pb-3";

const PHASES: readonly Phase[] = [
  "INITIALIZATION",
  "IDEATION",
  "INCEPTION",
  "CONSTRUCTION",
  "OPERATION",
];

export interface StageRailProps {
  state: ViewState<WorkflowModel>;
  onSelect: (slug: string) => void;
  onRetry: () => void;
  /** slug → purpose; shown from 48rem up when present. */
  purposes?: Readonly<Record<string, string>>;
  /** When set, marks this slug instead of workflow.currentStage. */
  markedSlug?: string;
  /** `null` until `/api/timings` lands — rows render without durations. */
  timings?: TimingsPayload | null;
  observedModels?: Record<string, string[]>;
  reviewedStages?: readonly string[];
  supportedStages?: readonly string[];
}

type Duration = { text: string; estimated: boolean } | null;

interface Run {
  phase: Phase;
  stages: StageInfo[];
}

function groupStages(stages: readonly StageInfo[]): Run[] {
  const runs: Run[] = [];
  for (const phase of PHASES) {
    const inPhase = stages.filter((stage) => stage.phase === phase);
    if (inPhase.length === 0) continue;
    runs.push({ phase, stages: inPhase });
  }
  return runs;
}

/**
 * ステージを選択する一覧行。状態と推定時間を表示し、解析エラーの詳細は詳細画面に委ねる。
 * キーボード移動に必要なフォーカス登録と操作は、一覧側から受け取る。
 */
function StageRailItem({
  stage,
  purpose,
  isCurrent,
  tabbable,
  duration,
  observed,
  hasReviewer,
  hasSupport,
  onSelect,
  onKeyDown,
  register,
}: {
  stage: StageInfo;
  purpose: string | undefined;
  isCurrent: boolean;
  tabbable: boolean;
  duration: Duration;
  observed?: string[];
  hasReviewer: boolean;
  hasSupport: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  register: (element: HTMLButtonElement | null) => void;
}): ReactNode {
  const skipped = stage.execution === "SKIP";
  return (
    <li>
      <button
        type="button"
        ref={register}
        className={cn(
          "flex w-full cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:bg-muted",
          "aria-[current=step]:border-primary aria-[current=step]:bg-muted aria-[current=step]:font-semibold",
          skipped && "opacity-60",
        )}
        aria-current={isCurrent ? "step" : undefined}
        tabIndex={tabbable ? 0 : -1}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        data-testid={`stage-rail-item-${stage.slug}`}
      >
        <StatusChip status={stage.unparseable === undefined ? stage.status : "unparseable"} />
        <span className="flex min-w-0 flex-col gap-0.5">
          {/* `font-[family-name:var(--font-mono)]`, not `font-mono`: the theme
              entry is `@theme inline`, so the utility bakes the default stack
              in and would stop following the VS Code editor font that
              `html[data-host="vscode"]` maps onto `--font-mono`. */}
          <span className="font-[family-name:var(--font-mono)] text-xs">
            {formatStageLabel(stage.slug)}
          </span>
          <StageModelLabel
            stage={stage.slug}
            observed={observed}
            hasReviewer={hasReviewer}
            hasSupport={hasSupport}
          />
          {purpose === undefined || purpose === "" ? null : (
            /* Narrow: slug + status only. From 48rem (md) up, show the stage
               purpose. `font-normal` on the span itself outranks the current
               row's inherited semibold. Same `--font-sans` caveat as above. */
            <span
              className="hidden font-[family-name:var(--font-sans,inherit)] text-muted-foreground text-xs font-normal leading-[1.35] whitespace-normal md:block"
              data-testid={`stage-rail-purpose-${stage.slug}`}
            >
              {purpose}
            </span>
          )}
        </span>
        {duration === null ? null : (
          /* Trailing edge of the row, so durations read down as one scannable
             column instead of landing wherever the purpose text happens to
             end. Tabular figures keep that column from jittering row to row.
             Muted + regular weight even on the current row: the emphasis there
             belongs to the stage, not its clock.

             Below 48rem the purpose is hidden, so no wrappable sibling is left
             to absorb a squeeze — chip and slug are both fixed. The duration
             gives way itself there (`flex-initial`); holding the column
             instead pushes the row past the viewport once the widest chip
             ("awaiting approval") meets a forecast label. From `md`
             up the purpose takes the squeeze and the column stays whole.

             A skipped row is already dimmed wholesale by the button's
             `opacity-60`; muting the figure on top of that stacks two
             reductions and costs real contrast (light theme: 2.32:1 → 1.90:1).
             Take the row's dim only. */
          <span
            className={cn(
              "ml-auto flex-initial text-xs font-normal tabular-nums md:flex-none md:whitespace-nowrap",
              !skipped && "text-muted-foreground",
            )}
            data-testid={`rail-duration-${stage.slug}`}
          >
            {/* Keep forecasts distinct from recorded durations without repeating labels. */}
            {duration.estimated
              ? `≈${duration.text}${stage.status === "not-started" || stage.status === "skipped" ? " (参考)" : ""}`
              : duration.text}
          </span>
        )}
      </button>
    </li>
  );
}

function StageRailImpl({
  state,
  onSelect,
  onRetry,
  purposes,
  markedSlug,
  timings,
  observedModels,
  reviewedStages,
  supportedStages,
}: StageRailProps): ReactNode {
  const showSkeleton = useDelayedLoading(state.kind === "loading");
  const [focused, setFocused] = useState(0);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const move = useCallback((from: number, delta: number, count: number) => {
    const next = Math.min(Math.max(from + delta, 0), count - 1);
    setFocused(next);
    items.current[next]?.focus();
  }, []);

  // One wrapper; only the body varies per view state.
  if (state.kind !== "success" && state.kind !== "partial") {
    return (
      <nav className={RAIL} aria-label="ステージ一覧">
        {state.kind === "loading" ? (
          showSkeleton ? (
            <Skeleton lines={6} label="ステージ一覧" />
          ) : null
        ) : state.kind === "error" ? (
          <AreaError detail={state.detail} onRetry={onRetry} />
        ) : (
          <p className="text-sm text-muted-foreground">{state.hint}</p>
        )}
      </nav>
    );
  }

  const workflow = state.value;
  const runs = groupStages(workflow.stages);
  const flat = runs.flatMap((run) => run.stages);
  items.current.length = flat.length;
  const highlighted = markedSlug ?? workflow.currentStage;

  // The rail used to reconcile `status` against the raw run list itself —
  // re-deriving "is a run open", "is this closed run still the current
  // attempt", and "which estimate belongs to the current stage" from three
  // different fields, with three chances to disagree with `estimate.ts`
  // (Codex round 9 finding 3 was exactly that disagreement). Those rules now
  // live once, in reader-core's `resolveStageViews`, and this is a lookup.
  const viewByStage = new Map((timings?.stageViews ?? []).map((view) => [view.stage, view]));

  /**
   * Finished attempts show work inferred from their logs; other rows show
   * the full estimated duration. Both are estimates, with different inputs.
   *
   * The measurement is gated on the view still describing the row in front of
   * us — see `stageViewMatches`. Nothing is re-derived here: this is the same
   * two-fetch freshness question NowStrip and Header already ask, asked per
   * row because that is the granularity a stage row renders at.
   */
  function durationOf(stage: StageInfo): Duration {
    const view = viewByStage.get(stage.slug);
    if (view === undefined) return null;
    if (view.actualActiveMs !== null && stageViewMatches(stage, view))
      return {
        text: formatTimingDuration(view.actualActiveMs),
        estimated: false,
      };
    if (view.estimateMs === null) return null;
    return {
      text: formatTimingDuration(view.estimateMs),
      estimated: true,
    };
  }

  const keyHandler =
    (index: number) =>
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        move(index, 1, flat.length);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(index, -1, flat.length);
      } else if (event.key === "Home") {
        event.preventDefault();
        move(0, 0, flat.length);
      } else if (event.key === "End") {
        event.preventDefault();
        move(flat.length - 1, 0, flat.length);
      }
    };

  let cursor = 0;
  return (
    <nav className={RAIL} aria-label="ステージ一覧">
      {runs.map((run) => (
        <section className="mb-4" key={run.phase} aria-label={run.phase}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {run.phase}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {run.stages.map((stage) => {
              const index = cursor;
              cursor += 1;
              return (
                <StageRailItem
                  observed={observedModels?.[stage.slug]}
                  hasReviewer={reviewedStages?.includes(stage.slug) ?? false}
                  hasSupport={supportedStages?.includes(stage.slug) ?? false}
                  key={stage.slug}
                  stage={stage}
                  purpose={purposes?.[stage.slug]}
                  isCurrent={stage.slug === highlighted}
                  tabbable={index === Math.min(focused, flat.length - 1)}
                  duration={durationOf(stage)}
                  onSelect={() => {
                    setFocused(index);
                    onSelect(stage.slug);
                  }}
                  onKeyDown={keyHandler(index)}
                  register={(element) => {
                    items.current[index] = element;
                  }}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export const StageRail = memo(StageRailImpl);
