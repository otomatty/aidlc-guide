import type { Phase, StageInfo, WorkflowModel } from "@aidlc-guide/shared-types";
import { type KeyboardEvent, memo, type ReactNode, useCallback, useRef, useState } from "react";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, Skeleton, UnparseableBadge } from "./atoms.tsx";
import { StatusChip } from "./StatusChip.tsx";

/**
 * US-16/18, FR-4.2/FR-4.5. Order is the server's array order — never re-sorted
 * here (R-UI-6). Keyboard model is roving tabindex: exactly one item is in the
 * tab order, arrows move between items (a11y checklist 2.1.1).
 */

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
}

interface Run {
  phase: Phase;
  executed: StageInfo[];
  skipped: StageInfo[];
}

/** Group by phase while preserving the server's within-phase order. */
export function groupStages(stages: readonly StageInfo[]): Run[] {
  const runs: Run[] = [];
  for (const phase of PHASES) {
    const inPhase = stages.filter((stage) => stage.phase === phase);
    if (inPhase.length === 0) continue;
    runs.push({
      phase,
      executed: inPhase.filter((stage) => stage.execution === "EXECUTE"),
      skipped: inPhase.filter((stage) => stage.execution === "SKIP"),
    });
  }
  return runs;
}

function StageRailItem({
  stage,
  isCurrent,
  tabbable,
  onSelect,
  onKeyDown,
  register,
}: {
  stage: StageInfo;
  isCurrent: boolean;
  tabbable: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  register: (element: HTMLButtonElement | null) => void;
}): ReactNode {
  return (
    <li className="rail__item">
      <button
        type="button"
        ref={register}
        className="rail__button"
        // The current stage is a step in a process, not a page (4.1.2).
        aria-current={isCurrent ? "step" : undefined}
        tabIndex={tabbable ? 0 : -1}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        data-testid={`stage-rail-item-${stage.slug}`}
      >
        <StatusChip status={stage.unparseable === undefined ? stage.status : "unparseable"} />
        <span className="rail__slug">{stage.slug}</span>
      </button>
      {stage.unparseable === undefined ? null : <UnparseableBadge detail={stage.unparseable} />}
    </li>
  );
}

function StageRailImpl({ state, onSelect, onRetry }: StageRailProps): ReactNode {
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
        <p className="rail__empty">{state.hint}</p>
      </nav>
    );
  }

  const workflow = state.value;
  const runs = groupStages(workflow.stages);
  // Flat index across phases: the arrow keys walk the rail, not the group.
  const flat = runs.flatMap((run) => run.executed);
  items.current.length = flat.length;

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
            {run.executed.map((stage) => {
              const index = cursor;
              cursor += 1;
              return (
                <StageRailItem
                  key={stage.slug}
                  stage={stage}
                  isCurrent={stage.slug === workflow.currentStage}
                  tabbable={index === Math.min(focused, flat.length - 1)}
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
          {run.skipped.length === 0 ? null : <SkipGroup stages={run.skipped} />}
        </section>
      ))}
    </nav>
  );
}

/** FR-4.5: SKIP runs collapse behind a `<details>` that states *why*. */
function SkipGroup({ stages }: { stages: StageInfo[] }): ReactNode {
  return (
    <details className="rail__skip" data-testid="skip-group">
      <summary>SKIP ({stages.length})</summary>
      <p className="rail__skip-reason">
        スコープ由来の SKIP — 現在のスコープではこれらのステージを実行しません。
      </p>
      <ul className="rail__list">
        {stages.map((stage) => (
          <li className="rail__item rail__item--skip" key={stage.slug}>
            <StatusChip status="skipped" />
            <span className="rail__slug">{stage.slug}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export const StageRail = memo(StageRailImpl);
