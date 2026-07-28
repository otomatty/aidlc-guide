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

  // A stage that is running right now has no *final* duration to report. Re-entry
  // (a rejected gate, a re-run) leaves the earlier attempt's closed run in the
  // timeline alongside the new open one, so keying only on `endedAt !== null`
  // would render the previous attempt as if it were this run's measurement.
  // Openness is a fact in the data — read it there rather than inferring it from
  // StageInfo.status, whose lifecycle is subtle: STAGE_COMPLETED fires *after*
  // GATE_APPROVED, so a stage sitting at `awaiting-approval` still has an open run
  // (confirmed against the real audit log: STAGE_AWAITING_APPROVAL, then
  // GATE_APPROVED and STAGE_COMPLETED sharing a timestamp).
  //
  // Codex round 9, finding 3: that data-only check answers "is a run open
  // right now?" but not "is this CLOSED run still the current attempt?" — a
  // different question estimate.ts's CURRENT_ATTEMPT_STATUSES already had to
  // answer (see its comment). A backward jump (`aidlc-jump.ts`) resets a
  // downstream stage's status to `not-started` without touching its old,
  // already-closed audit rows — no open run exists yet for the rerun, so the
  // data-only check alone lets that stale closed run through as if it were
  // current. Both signals are needed together, for different questions: the
  // data still decides openness (unchanged, per the paragraph above), and
  // `StageInfo.status` decides whether a closed run is history or the
  // current, already-finished attempt — only `completed` and
  // `awaiting-approval` (STAGE_COMPLETED fires after GATE_APPROVED, see
  // above) count as "current". `not-started` here reads as history, not as
  // "no run to show" — a stage with a closed run but reset status still has
  // one, it's just not this attempt's, so the estimate is what should render.
  const statusByStage = new Map(workflow.stages.map((s) => [s.slug, s.status] as const));
  const isCurrentAttemptStatus = (slug: string): boolean => {
    const status = statusByStage.get(slug);
    return status === "completed" || status === "awaiting-approval";
  };
  const runningStages = new Set(
    (timings?.timings ?? []).filter((t) => t.endedAt === null).map((t) => t.stage),
  );
  const actualByStage = new Map(
    (timings?.timings ?? [])
      .filter(
        (t) => t.endedAt !== null && !runningStages.has(t.stage) && isCurrentAttemptStatus(t.stage),
      )
      .map((t) => [t.stage, t.activeMs] as const),
  );
  // Carries `lowConfidence` alongside `estimateMs` (Codex round 13, finding
  // 3): a `pendingStages` entry keeps its full `StageEstimate` — basis and
  // sampleCount included — so a fallback (phase/global median, or a single
  // sample) can be told apart from the stage's own, better-attested history
  // rather than rendering identically. Uses the same predicate estimate.ts
  // aggregates into `RemainingEstimate.lowConfidence`, not a second
  // definition of "low confidence".
  const estimateByStage = new Map(
    (timings?.remaining.pendingStages ?? [])
      .filter((s) => s.estimateMs !== null)
      .map((s) => [
        s.stage,
        { estimateMs: s.estimateMs as number, lowConfidence: isLowConfidenceEstimate(s) },
      ]),
  );
  // Codex round 12, finding 1: `pendingStages` deliberately never contains the
  // current stage (it's represented by `remaining.currentStage` instead, to
  // avoid double-counting it in `totalRemainingMs`) — but that leaves the
  // current stage's own row with no source in this map at all. When the
  // current stage hasn't started yet (`aidlc-state.ts finalize` advances
  // `Current Stage` before any `STAGE_STARTED`), `remainingMs` there is a
  // full estimate exactly like any pendingStages entry, so seed it in too.
  // When the current stage IS running, `remainingMs` is only the remainder of
  // the estimate, not the full duration — showing that next to every other
  // row's full duration would misrepresent "how long this stage takes", so we
  // deliberately leave a running current row blank (unchanged from today).
  // `runningStages` (an open `timings` entry for the slug) is exactly the
  // "has it started" signal already used above, so it also distinguishes the
  // two cases here.
  //
  // `RemainingEstimate.currentStage` now carries `basis`/`sampleCount`
  // alongside `stage`/`elapsedActiveMs`/`remainingMs`, so this row runs
  // through the same `isLowConfidenceEstimate` predicate as every
  // `pendingStages` row instead of being assumed high confidence.
  const remainingCurrent = timings?.remaining.currentStage;
  if (
    remainingCurrent != null &&
    remainingCurrent.remainingMs !== null &&
    !runningStages.has(remainingCurrent.stage)
  ) {
    estimateByStage.set(remainingCurrent.stage, {
      estimateMs: remainingCurrent.remainingMs,
      lowConfidence: isLowConfidenceEstimate(remainingCurrent),
    });
  }

  /** Actuals win over estimates: a measured run is not a guess. */
  function durationOf(slug: string): Duration {
    const actual = actualByStage.get(slug);
    if (actual !== undefined)
      return { text: formatDuration(actual), estimated: false, lowConfidence: false };
    const estimate = estimateByStage.get(slug);
    if (estimate === undefined) return null;
    return {
      text: formatDuration(estimate.estimateMs),
      estimated: true,
      lowConfidence: estimate.lowConfidence,
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
                  duration={durationOf(stage.slug)}
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
