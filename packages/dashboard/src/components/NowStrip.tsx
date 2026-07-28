import type { TimingsPayload, WorkflowModel } from "@aidlc-guide/shared-types";
import { currentStageMatches, formatDuration } from "@aidlc-guide/shared-types";
import { memo, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, EmptyState, Skeleton, UnparseableBadge } from "./atoms.tsx";
import { explainNowFields, type FieldExplain } from "./now-strip-explain.ts";
import { StatusChip } from "./StatusChip.tsx";

export interface NowStripProps {
  state: ViewState<WorkflowModel>;
  onRetry: () => void;
  intentPicker?: ReactNode;
  /** `null` until `/api/timings` lands — the strip renders without it. */
  timings?: TimingsPayload | null;
  /**
   * Degradation notes from a `partial` `/api/timings` response (unreadable
   * audit shard, malformed timestamp, an intent skipped during the space
   * sweep) — about the timing data as a whole, not any one stage, so they
   * render here rather than duplicated per StageRail row (finding 2, Codex
   * round 13). Reuses NowStrip's existing workflow-notes pattern below
   * instead of a second one.
   */
  timingsNotes?: string[];
}

function ExplainCard({
  fieldKey,
  label,
  explain,
  children,
}: {
  fieldKey: string;
  label: string;
  explain: FieldExplain;
  children: ReactNode;
}): ReactNode {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="now__field now__field--explain"
            data-testid={`now-field-${fieldKey}`}
          />
        }
      >
        <span className="now__label">{label}</span>
        <span className="now__value">{children}</span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-80 max-w-[min(20rem,calc(100vw-2rem))] p-3"
        data-testid={`now-explain-${fieldKey}`}
      >
        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{explain.definition}</p>
          <p className="text-xs leading-relaxed">
            <span className="font-medium">いま: </span>
            {explain.current}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground leading-relaxed">
            {explain.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function NowStripImpl({
  state,
  onRetry,
  intentPicker,
  timings,
  timingsNotes,
}: NowStripProps): ReactNode {
  const showSkeleton = useDelayedLoading(state.kind === "loading");

  return (
    <section className="now" aria-labelledby="now-heading">
      <h2 id="now-heading" className="now__heading" tabIndex={-1}>
        現在地
      </h2>
      {state.kind === "loading" ? (
        showSkeleton ? (
          <Skeleton lines={2} label="現在地" />
        ) : null
      ) : state.kind === "empty" ? (
        <EmptyState hint={state.hint}>{intentPicker}</EmptyState>
      ) : state.kind === "error" ? (
        <AreaError detail={state.detail} onRetry={onRetry} />
      ) : (
        <NowStripBody
          workflow={state.value}
          notes={[...(state.kind === "partial" ? state.notes : []), ...(timingsNotes ?? [])]}
          timings={timings ?? null}
        />
      )}
    </section>
  );
}

function NowStripBody({
  workflow,
  notes,
  timings,
}: {
  workflow: WorkflowModel;
  notes: string[];
  timings: TimingsPayload | null;
}): ReactNode {
  // `workflow` and `timings` are two independent fetches (see NowStripProps):
  // when a change push advances the current stage, `workflow` re-renders
  // immediately while `/api/timings` may still describe the previous stage.
  // Which view is the current one was already decided in reader-core (issue
  // #9) — all that is left here is the freshness gate, computed once so the
  // rendered fields below and the hover-card copy (explainNowFields) cannot
  // diverge. Same guard as status-bar.ts's refreshStatusBar.
  const timedCurrent = timings?.stageViews.find((view) => view.isCurrent) ?? null;
  const current = currentStageMatches(workflow.currentStage, timedCurrent) ? timedCurrent : null;
  const explain = explainNowFields(workflow, current);

  return (
    <>
      <div className="now__row">
        <ExplainCard fieldKey="phase" label="フェーズ" explain={explain.phase}>
          {workflow.phase}
        </ExplainCard>
        <ExplainCard fieldKey="stage" label="現在のステージ" explain={explain.stage}>
          {workflow.currentStage ?? "（なし）"}
        </ExplainCard>
        <ExplainCard fieldKey="scope" label="スコープ" explain={explain.scope}>
          <span data-testid="now-scope">{workflow.scope}</span>
        </ExplainCard>
        <ExplainCard fieldKey="depth" label="Depth" explain={explain.depth}>
          {workflow.depth}
        </ExplainCard>
        <ExplainCard fieldKey="gate" label="ゲート" explain={explain.gate}>
          {workflow.gate === null ? "—" : <StatusChip status={workflow.gate} />}
        </ExplainCard>
        <ExplainCard fieldKey="done" label="完了" explain={explain.done}>
          <span data-testid="done-total">
            {workflow.done} / {workflow.total}
          </span>
        </ExplainCard>
        <ExplainCard fieldKey="elapsed" label="経過" explain={explain.elapsed}>
          <span data-testid="now-elapsed">{formatDuration(current?.elapsedActiveMs ?? null)}</span>
        </ExplainCard>
        <ExplainCard fieldKey="remaining" label="残り" explain={explain.remaining}>
          <span data-testid="now-remaining">
            {current === null || current.remainingMs === null ? (
              "—"
            ) : (
              <>
                ≈{formatDuration(current.remainingMs)}
                {/* Symbol + text, never colour alone (project.md rough-mockups). */}
                <span className="now__hint"> 推定</span>
              </>
            )}
          </span>
        </ExplainCard>
      </div>
      {notes.length === 0 ? null : (
        <ul className="now__notes">
          {notes.map((note) => (
            <li key={note}>
              <UnparseableBadge detail={note} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export const NowStrip = memo(NowStripImpl);
