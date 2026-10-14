import {
  formatTimingDuration,
  type Phase,
  type StageInfo,
  stageViewMatches,
  type TimingsPayload,
  type UnitWalk,
  type WorkflowModel,
} from "@aidlc-guide/shared-types";
import { type KeyboardEvent, memo, type ReactNode, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatStageLabel } from "@/data/stage-numbers.ts";
import type { ViewState } from "@/store/state.ts";
import { AreaError } from "@/shared/atoms.tsx";
import { StageRailSkeleton } from "@/features/home/components/StageRailSkeleton.tsx";
import { type ModelLoadState, StageModelLabel } from "./StageModelLabel.tsx";
import { StatusChip } from "@/shared/ui/StatusChip.tsx";
import { ActiveUnitTag, UnitGroupToggle, UnitProgress, UnitStepRow } from "./StageRailUnits.tsx";

/** The rail's own frame, shared by the loaded and not-yet-loaded wrappers. */
const RAIL = "border-b pb-3";

const PHASES: readonly Phase[] = [
  "INITIALIZATION",
  "IDEATION",
  "INCEPTION",
  "CONSTRUCTION",
  "OPERATION",
];

const ITERATION_HINT = {
  "unit-major": "Unit ごとに 3.1〜3.5 を終えてから、次の Unit へ進みます",
  "stage-major": "ステージごとに全 Unit を終えてから、次のステージへ進みます",
} as const;

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
  modelLoadState?: ModelLoadState;
  usageLoadState?: ModelLoadState;
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
  modelLoadState,
  usageLoadState,
  onSelect,
  onKeyDown,
  register,
  units,
}: {
  stage: StageInfo;
  /** Unit progress and the open Unit, shown under the stage name. */
  units?: ReactNode;
  purpose: string | undefined;
  isCurrent: boolean;
  tabbable: boolean;
  duration: Duration;
  observed?: string[];
  hasReviewer: boolean;
  hasSupport: boolean;
  modelLoadState?: ModelLoadState;
  usageLoadState?: ModelLoadState;
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
          <span className="font-mono text-xs">{formatStageLabel(stage.slug)}</span>
          <StageModelLabel
            stage={stage.slug}
            observed={observed}
            hasReviewer={hasReviewer}
            hasSupport={hasSupport}
            loadState={modelLoadState}
            usageLoadState={usageLoadState}
          />
          {units}
          {purpose === undefined || purpose === "" ? null : (
            /* Narrow: slug + status only. From 48rem (md) up, show the stage
               purpose. `font-normal` on the span itself outranks the current
               row's inherited semibold. */
            <span
              className="hidden font-sans text-muted-foreground text-xs font-normal leading-snug whitespace-normal md:block"
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

/** One focusable control in the rail, in the order focus moves through them. */
type Entry =
  | { kind: "stage"; stage: StageInfo }
  | { kind: "group"; unit: string }
  | { kind: "step"; unit: string; stage: string };

/**
 * How the CONSTRUCTION section lays out Units: `grouped` (unit-major) lists
 * each Unit's steps under it; `progress` (stage-major, or no recorded
 * iteration) keeps the stage rows and lays the Units across them. `null` when
 * there is no Unit walk to show yet, so the rail stays as it was.
 */
function unitLayout(workflow: WorkflowModel, walk: UnitWalk | null): "grouped" | "progress" | null {
  if (walk === null || walk.units.length === 0 || walk.stages.length === 0) return null;
  return workflow.constructionPolicy?.unitMajor === true ? "grouped" : "progress";
}

/**
 * The Unit to open under unit-major: the state file's open Unit, else the
 * first Unit that has started and not finished, else the first not started.
 */
function focusUnitOf(workflow: WorkflowModel, walk: UnitWalk): string | null {
  const active = workflow.activeUnit?.unit;
  if (active !== undefined && walk.units.some((unit) => unit.unit === active)) return active;
  return (
    walk.units.find((unit) => unit.status === "in-progress")?.unit ??
    walk.units.find((unit) => unit.status === "not-started")?.unit ??
    null
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
  modelLoadState,
  usageLoadState,
}: StageRailProps): ReactNode {
  const [focused, setFocused] = useState(0);
  /** Units the person opened or closed; the rest follow {@link focusUnitOf}. */
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});
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
          <StageRailSkeleton />
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
  const walk = timings?.unitWalk ?? null;
  const layout = unitLayout(workflow, walk);
  const unitStages = new Set(layout === null ? [] : (walk?.stages ?? []));
  const progressByStage = new Map(
    layout === "progress" ? (walk?.byStage ?? []).map((row) => [row.stage, row]) : [],
  );
  const active = workflow.activeUnit;
  const focusUnit = layout === "grouped" && walk !== null ? focusUnitOf(workflow, walk) : null;
  const isOpen = (unit: string): boolean => toggled[unit] ?? unit === focusUnit;
  // Under unit-major Current Stage stays on the first per-Unit stage; the
  // open Unit's own stage is where the work is.
  const highlighted =
    markedSlug ??
    (layout === "grouped" && active?.unit === focusUnit ? active?.stage : null) ??
    workflow.currentStage;

  const entriesOf = (stages: readonly StageInfo[], phase: Phase): Entry[] => {
    if (layout !== "grouped" || phase !== "CONSTRUCTION" || walk === null)
      return stages.map((stage) => ({ kind: "stage", stage }));
    const groups = walk.units.flatMap((unit): Entry[] => [
      { kind: "group", unit: unit.unit },
      ...(isOpen(unit.unit)
        ? unit.steps.map((step): Entry => ({ kind: "step", unit: unit.unit, stage: step.stage }))
        : []),
    ]);
    const once = stages
      .filter((stage) => !unitStages.has(stage.slug))
      .map((stage): Entry => ({ kind: "stage", stage }));
    return [...groups, ...once];
  };
  const sections = runs.map((run) => ({
    phase: run.phase,
    entries: entriesOf(run.stages, run.phase),
  }));
  const count = sections.reduce((sum, section) => sum + section.entries.length, 0);
  items.current.length = count;

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
        move(index, 1, count);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(index, -1, count);
      } else if (event.key === "Home") {
        event.preventDefault();
        move(0, 0, count);
      } else if (event.key === "End") {
        event.preventDefault();
        move(count - 1, 0, count);
      }
    };

  const roving = (index: number) => ({
    tabbable: index === Math.min(focused, count - 1),
    onKeyDown: keyHandler(index),
    register: (element: HTMLButtonElement | null) => {
      items.current[index] = element;
    },
  });

  // Shown only when the state file records a choice: an absent line means the
  // workflow never picked one (no Units, or a record older than the setting).
  const policy = workflow.constructionPolicy;
  const iteration =
    policy?.iterationRecorded === true ? (policy.unitMajor ? "unit-major" : "stage-major") : null;

  const stageRow = (stage: StageInfo, index: number): ReactNode => {
    const progress = stage.execution === "EXECUTE" ? progressByStage.get(stage.slug) : undefined;
    const working = active?.stage === stage.slug ? active : undefined;
    const unitInfo =
      progress === undefined && working === undefined ? undefined : (
        <>
          {progress === undefined || walk === null ? null : (
            <UnitProgress slug={stage.slug} units={walk.units} progress={progress} />
          )}
          {working === undefined ? null : <ActiveUnitTag active={working} />}
        </>
      );
    return (
      <StageRailItem
        observed={observedModels?.[stage.slug]}
        hasReviewer={reviewedStages?.includes(stage.slug) ?? false}
        hasSupport={supportedStages?.includes(stage.slug) ?? false}
        modelLoadState={modelLoadState}
        usageLoadState={usageLoadState}
        key={stage.slug}
        stage={stage}
        units={unitInfo}
        purpose={purposes?.[stage.slug]}
        isCurrent={stage.slug === highlighted}
        tabbable={index === Math.min(focused, count - 1)}
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
  };

  let cursor = 0;
  const take = (): number => {
    const index = cursor;
    cursor += 1;
    return index;
  };

  /** unit-major CONSTRUCTION: each Unit with its steps, then the stages run once. */
  const groupedBody = (entries: readonly Entry[]): ReactNode => {
    if (walk === null) return null;
    const once = entries.flatMap((entry) => (entry.kind === "stage" ? [entry.stage] : []));
    return (
      <>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {walk.units.map((unit) => {
            const open = isOpen(unit.unit);
            const groupIndex = take();
            const working =
              active !== undefined && active.unit === unit.unit && active.stage !== null
                ? { stage: active.stage, paused: active.state === "paused" }
                : null;
            return (
              <li key={unit.unit} className="flex flex-col gap-1">
                <UnitGroupToggle
                  {...roving(groupIndex)}
                  unit={unit}
                  open={open}
                  working={working}
                  onToggle={() => {
                    setFocused(groupIndex);
                    setToggled((prev) => ({ ...prev, [unit.unit]: !open }));
                  }}
                />
                {open ? (
                  <ul className="m-0 flex list-none flex-col gap-1 py-0 pr-0 pl-4">
                    {unit.steps.map((step) => {
                      const index = take();
                      return (
                        <UnitStepRow
                          key={step.stage}
                          {...roving(index)}
                          unit={unit.unit}
                          step={step}
                          isCurrent={unit.unit === focusUnit && step.stage === highlighted}
                          onSelect={() => {
                            setFocused(index);
                            onSelect(step.stage);
                          }}
                        />
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
        {once.length === 0 ? null : (
          <>
            <div className="mx-2 mt-3 mb-1 flex items-center gap-2" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">全 Unit の完了後に 1 回</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {once.map((stage) => stageRow(stage, take()))}
            </ul>
          </>
        )}
      </>
    );
  };

  return (
    <nav className={RAIL} aria-label="ステージ一覧">
      {sections.map((section) => (
        <section className="mb-4" key={section.phase} aria-label={section.phase}>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">
              {section.phase}
            </h3>
            {section.phase === "CONSTRUCTION" && iteration !== null ? (
              <span
                className="text-xs text-muted-foreground"
                title={ITERATION_HINT[iteration]}
                data-testid="construction-iteration"
              >
                進め方: {iteration}
              </span>
            ) : null}
          </div>
          {layout === "grouped" && section.phase === "CONSTRUCTION" ? (
            groupedBody(section.entries)
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {section.entries.map((entry) =>
                entry.kind === "stage" ? stageRow(entry.stage, take()) : null,
              )}
            </ul>
          )}
        </section>
      ))}
    </nav>
  );
}

export const StageRail = memo(StageRailImpl);
