import type { WorkflowModel } from "@aidlc-guide/shared-types";
import { memo, type ReactNode } from "react";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, EmptyState, Skeleton, UnparseableBadge } from "./atoms.tsx";
import { StatusChip } from "./StatusChip.tsx";

/**
 * US-01 / FR-4.1: the S-1 north star lives here — phase, stage, unit, gate and
 * the completed tally must be readable **without any further interaction**.
 * Every number is printed exactly as the server sent it (BR-UI-3).
 */

export interface NowStripProps {
  state: ViewState<WorkflowModel>;
  onRetry: () => void;
  intentPicker?: ReactNode;
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="now__field">
      <span className="now__label">{label}</span>
      <span className="now__value">{children}</span>
    </div>
  );
}

function NowStripImpl({ state, onRetry, intentPicker }: NowStripProps): ReactNode {
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
        <NowStripBody workflow={state.value} notes={state.kind === "partial" ? state.notes : []} />
      )}
    </section>
  );
}

function NowStripBody({
  workflow,
  notes,
}: {
  workflow: WorkflowModel;
  notes: string[];
}): ReactNode {
  return (
    <>
      <div className="now__row">
        <Field label="フェーズ">{workflow.phase}</Field>
        <Field label="現在のステージ">{workflow.currentStage ?? "（なし）"}</Field>
        <Field label="Depth">{workflow.depth}</Field>
        <Field label="ゲート">
          {workflow.gate === null ? "—" : <StatusChip status={workflow.gate} />}
        </Field>
        <Field label="完了">
          {/* Server-side tally, never recomputed here (BR-UI-3 / G-5, G-6). */}
          <span data-testid="done-total">
            {workflow.done} / {workflow.total}
          </span>
        </Field>
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
