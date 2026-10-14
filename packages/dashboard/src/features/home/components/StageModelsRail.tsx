import { useFetchView } from "@/hooks/useFetchView.ts";
import { fetchStageModels } from "@/services/api.ts";
import { viewValue } from "@/store/state.ts";
import { StageRail, type StageRailProps } from "./StageRail.tsx";

/**
 * Refresh with the existing workflow/timing feed; no extra polling loop. Each
 * feed update keeps the badges already shown until the refresh lands, so the
 * 30s timings poll and change pushes do not blink them through 読み込み中.
 */
export function StageModelsRail(props: StageRailProps) {
  const ready = props.state.kind === "success" || props.state.kind === "partial";
  const view = useFetchView(ready ? fetchStageModels : null, [props.state, props.timings], {
    keepPrevious: true,
  });
  const data = view === null ? null : viewValue(view);
  const modelLoadState =
    view === null || view.kind === "loading" ? "loading" : data === null ? "error" : "ready";
  const usageLoadState =
    modelLoadState === "ready" && data?.observed === null ? "error" : modelLoadState;
  const reviewedStages = data?.harnesses.flatMap((harness) =>
    harness.stages.filter((stage) => stage.reviewer !== null).map((stage) => stage.slug),
  );
  const supportedStages = data?.harnesses.flatMap((harness) =>
    harness.stages.filter((stage) => stage.supports.length > 0).map((stage) => stage.slug),
  );
  return (
    <StageRail
      {...props}
      modelLoadState={modelLoadState}
      usageLoadState={usageLoadState}
      observedModels={data?.observed ?? undefined}
      reviewedStages={reviewedStages}
      supportedStages={supportedStages}
    />
  );
}
