import { useFetchView } from "../hooks/useFetchView.ts";
import { fetchStageModels } from "../services/api.ts";
import { viewValue } from "../store/state.ts";
import { StageRail, type StageRailProps } from "./StageRail.tsx";

/** Refresh with the existing workflow/timing feed; no extra polling loop. */
export function StageModelsRail(props: StageRailProps) {
  const ready = props.state.kind === "success" || props.state.kind === "partial";
  const view = useFetchView(ready ? fetchStageModels : null, [props.state, props.timings]);
  const data = view === null ? null : viewValue(view);
  const modelLoadState =
    view === null || view.kind === "loading" ? "loading" : data === null ? "error" : "ready";
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
      observedModels={data?.observed}
      reviewedStages={reviewedStages}
      supportedStages={supportedStages}
    />
  );
}
