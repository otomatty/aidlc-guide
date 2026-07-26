import type { WorkflowModel } from "@aidlc-guide/shared-types";
import { memo, type ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import type { ViewState } from "../store/state.ts";
import { AreaError, EmptyState, Skeleton, UnparseableBadge } from "./atoms.tsx";
import {
  type FieldExplain,
  explainNowFields,
} from "./now-strip-explain.ts";
import { StatusChip } from "./StatusChip.tsx";

export interface NowStripProps {
  state: ViewState<WorkflowModel>;
  onRetry: () => void;
  intentPicker?: ReactNode;
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
  const explain = explainNowFields(workflow);

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
