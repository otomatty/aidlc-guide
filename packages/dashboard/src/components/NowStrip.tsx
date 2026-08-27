import type { StageView, WorkflowModel } from "@aidlc-guide/shared-types";
import { formatDuration } from "@aidlc-guide/shared-types";
import { memo, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { inVsCodeWebview } from "../services/vscode-api.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, EmptyState, Skeleton, UnparseableBadge } from "./atoms.tsx";
import { explainNowFields, type FieldExplain } from "./now-strip-explain.ts";
import { PreflightWizard } from "./PreflightWizard.tsx";
import { StatusChip } from "./StatusChip.tsx";

export interface NowStripProps {
  state: ViewState<WorkflowModel>;
  onRetry: () => void;
  intentPicker?: ReactNode;
  /**
   * The current stage's reconciled timing view, already gated on freshness by
   * `store/select-timing.ts` — `null` until `/api/timings` lands, when the
   * workflow has no current stage, or when the payload still describes the
   * stage that was current a moment ago. The strip renders without it and
   * makes no staleness judgement of its own (issue #10).
   */
  current?: StageView | null;
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
            className="flex cursor-help flex-col gap-1 rounded-sm border border-dashed border-transparent px-1 py-0.5 text-left hover:border-border hover:bg-muted focus-visible:border-border focus-visible:bg-muted focus-visible:outline-none"
            data-testid={`now-field-${fieldKey}`}
          />
        }
      >
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="text-sm">{children}</span>
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
  current,
  timingsNotes,
}: NowStripProps): ReactNode {
  const showSkeleton = useDelayedLoading(state.kind === "loading");

  return (
    <section className="border-b px-4 py-3" aria-labelledby="now-heading">
      <h2 id="now-heading" className="mb-3 text-base font-semibold" tabIndex={-1}>
        現在地
      </h2>
      {state.kind === "loading" ? (
        showSkeleton ? (
          <Skeleton lines={2} label="現在地" />
        ) : null
      ) : state.kind === "empty" ? (
        // The wizard's "describe what to build" CTA mints a *new* intent — it
        // only belongs on `no-active-intent`. `state-missing` means an intent
        // already exists (spec §9); showing the wizard there would let a user
        // accidentally start a second one, so it falls back to EmptyState.
        inVsCodeWebview() && state.reason === "no-active-intent" ? (
          <PreflightWizard hint={state.hint}>{intentPicker}</PreflightWizard>
        ) : (
          <EmptyState
            hint={state.hint}
            showCreateHint={state.reason === "no-active-intent"}
            title={
              state.reason === "no-selected-intent"
                ? "インテントを選んでください"
                : "ワークフローはまだありません"
            }
          >
            {intentPicker}
          </EmptyState>
        )
      ) : state.kind === "error" ? (
        <AreaError detail={state.detail} onRetry={onRetry} />
      ) : (
        <NowStripBody
          workflow={state.value}
          notes={[...(state.kind === "partial" ? state.notes : []), ...(timingsNotes ?? [])]}
          current={current ?? null}
        />
      )}
    </section>
  );
}

function NowStripBody({
  workflow,
  notes,
  current,
}: {
  workflow: WorkflowModel;
  notes: string[];
  current: StageView | null;
}): ReactNode {
  // One value, read by both the fields below and the hover-card copy, so the
  // two cannot diverge. Which view is current was decided in reader-core
  // (issue #9); whether it is still fresh was decided in the store selector
  // (issue #10). Nothing left to get wrong here.
  const explain = explainNowFields(workflow, current);

  return (
    <>
      <div className="flex flex-wrap gap-6">
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
                {/* Symbol + text, never colour alone (project.md rough-mockups).
                    The qualifier is subordinate to the figure it qualifies,
                    never mistaken for part of it. `nowrap` matters for
                    Japanese: without it the line can break between 推 and 定.
                    The separating space is the literal below, so no margin
                    here — it would double up. */}
                <span className="whitespace-nowrap text-muted-foreground text-xs"> 推定</span>
              </>
            )}
          </span>
        </ExplainCard>
      </div>
      {notes.length === 0 ? null : (
        <ul className="mt-3 flex list-none flex-col gap-2 p-0">
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
