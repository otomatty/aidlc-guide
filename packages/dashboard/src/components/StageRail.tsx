import {
  isLowConfidenceEstimate,
  type Phase,
  type StageInfo,
  type TimingsPayload,
  type WorkflowModel,
} from "@aidlc-guide/shared-types";
import { type KeyboardEvent, memo, type ReactNode, useCallback, useRef, useState } from "react";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { formatDuration } from "../lib/format-duration.ts";
import { stageViewMatches } from "../lib/stage-match.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, Skeleton, UnparseableBadge } from "./atoms.tsx";
import { StatusChip } from "./StatusChip.tsx";

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
}

type Duration = { text: string; estimated: boolean; lowConfidence: boolean } | null;

interface Run {
  phase: Phase;
  stages: StageInfo[];
}

export function groupStages(stages: readonly StageInfo[]): Run[] {
  const runs: Run[] = [];
  for (const phase of PHASES) {
    const inPhase = stages.filter((stage) => stage.phase === phase);
    if (inPhase.length === 0) continue;
    runs.push({ phase, stages: inPhase });
  }
  return runs;
}

function StageRailItem({
  stage,
  purpose,
  isCurrent,
  tabbable,
  duration,
  onSelect,
  onKeyDown,
  register,
}: {
  stage: StageInfo;
  purpose: string | undefined;
  isCurrent: boolean;
  tabbable: boolean;
  duration: Duration;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  register: (element: HTMLButtonElement | null) => void;
}): ReactNode {
  const skipped = stage.execution === "SKIP";
  return (
    <li className={skipped ? "rail__item--skip" : undefined}>
      <button
        type="button"
        ref={register}
        className="rail__button"
        aria-current={isCurrent ? "step" : undefined}
        tabIndex={tabbable ? 0 : -1}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        data-testid={`stage-rail-item-${stage.slug}`}
      >
        <StatusChip status={stage.unparseable === undefined ? stage.status : "unparseable"} />
        <span className="rail__text">
          <span className="rail__slug">{formatStageLabel(stage.slug)}</span>
          {purpose === undefined || purpose === "" ? null : (
            <span className="rail__purpose" data-testid={`stage-rail-purpose-${stage.slug}`}>
              {purpose}
            </span>
          )}
        </span>
        {duration === null ? null : (
          <span className="rail__duration" data-testid={`rail-duration-${stage.slug}`}>
            {/* Symbol + text, never colour alone (project.md rough-mockups). */}
            {duration.estimated
              ? `≈${duration.text} 推定${duration.lowConfidence ? "（参考値）" : ""}`
              : duration.text}
          </span>
        )}
      </button>
      {stage.unparseable === undefined ? null : (
        <div className="rail__note">
          <UnparseableBadge detail={stage.unparseable} />
        </div>
      )}
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
}: StageRailProps): ReactNode {
  const showSkeleton = useDelayedLoading(state.kind === "loading");
  const [focused, setFocused] = useState(0);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const move = useCallback((from: number, delta: number, count: number) => {
    const next = Math.min(Math.max(from + delta, 0), count - 1);
    setFocused(next);
    items.current[next]?.focus();
  }, []);

  if (state.kind === "loading") {
    return (
      <nav className="rail" aria-label="ステージ一覧">
        {showSkeleton ? <Skeleton lines={6} label="ステージ一覧" /> : null}
      </nav>
    );
  }
  if (state.kind === "error") {
    return (
      <nav className="rail" aria-label="ステージ一覧">
        <AreaError detail={state.detail} onRetry={onRetry} />
      </nav>
    );
  }
  if (state.kind === "empty") {
    return (
      <nav className="rail" aria-label="ステージ一覧">
        <p className="text-sm text-muted-foreground">{state.hint}</p>
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
   * Actuals win over estimates: a measured run is not a guess. This column
   * means "how long this stage takes" throughout — measured where the current
   * attempt has finished, expected everywhere else, including while a run is
   * open. (The *remainder* of a running stage is a different number and lives
   * where it is labelled as such: NowStrip's 残り and the header total.)
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
      return { text: formatDuration(view.actualActiveMs), estimated: false, lowConfidence: false };
    if (view.estimateMs === null) return null;
    // Same predicate reader-core aggregates into `RemainingEstimate
    // .lowConfidence`, not a second definition — a fallback (phase/global
    // median, or a single sample) must not read like a measurement.
    return {
      text: formatDuration(view.estimateMs),
      estimated: true,
      lowConfidence: isLowConfidenceEstimate(view),
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
    <nav className="rail" aria-label="ステージ一覧">
      {runs.map((run) => (
        <section className="rail__phase" key={run.phase} aria-label={run.phase}>
          <h3 className="rail__phase-heading">{run.phase}</h3>
          <ul className="rail__list">
            {run.stages.map((stage) => {
              const index = cursor;
              cursor += 1;
              return (
                <StageRailItem
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
