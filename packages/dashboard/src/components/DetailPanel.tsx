import type { MatrixCell } from "@aidlc-guide/shared-types";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ChevronLeftIcon, ChevronRightIcon, ListIcon, XIcon } from "lucide-react";
import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { refetchAll } from "../services/api.ts";
import { slugOf } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import type { Selection } from "../store/state.ts";
import { viewValue } from "../store/state.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { cellsWithArtifacts, StageArtifacts } from "./StageArtifacts.tsx";
import { StageCard } from "./StageCard.tsx";
import { StageRailDialog } from "./StageRailDialog.tsx";

const ArtifactViewer = lazy(async () => await import("../viewer/index.tsx"));

const preventDefault = (event: Event): void => {
  event.preventDefault();
};

export function adjacentStages(
  stages: readonly { slug: string }[],
  slug: string,
): { prev: string | null; next: string | null } {
  const index = stages.findIndex((stage) => stage.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? (stages[index - 1]?.slug ?? null) : null,
    next: index < stages.length - 1 ? (stages[index + 1]?.slug ?? null) : null,
  };
}

/** Decide which matrix cells to surface under the stage explanation. */
export function resolveArtifactCells(
  cells: readonly MatrixCell[],
  selection: NonNullable<Selection>,
  stage: string,
): { cells: MatrixCell[]; initialUnit: string } | null {
  const withFiles = cellsWithArtifacts(cells, stage);

  if (selection.kind === "cell") {
    const selected = cells.find(
      (each) => each.unit === selection.unit && each.stage === selection.stage,
    );
    if (selected === undefined) {
      const first = withFiles[0];
      return first === undefined ? null : { cells: withFiles, initialUnit: first.unit };
    }
    // Empty cell click keeps the empty viewer; do not jump to a sibling unit.
    if (selected.files.length === 0) {
      return { cells: [selected], initialUnit: selected.unit };
    }
    return { cells: withFiles, initialUnit: selected.unit };
  }

  const first = withFiles[0];
  return first === undefined ? null : { cells: withFiles, initialUnit: first.unit };
}

export function DetailPanel(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<Element | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  const slug = slugOf(state.selected);
  const doc = slug === null ? undefined : state.stageDoc[slug];
  const showSkeleton = useDelayedLoading(doc?.kind === "loading");

  const stagePurposes = useMemo(() => {
    const purposes: Record<string, string> = {};
    for (const [key, entry] of Object.entries(state.stageDoc)) {
      if (entry.kind === "success" || entry.kind === "partial") {
        purposes[key] = entry.value.purpose;
      }
    }
    return purposes;
  }, [state.stageDoc]);

  const retry = useCallback(() => {
    dispatch({ type: "reloading" });
    void refetchAll(dispatch);
  }, [dispatch]);

  useEffect(() => {
    if (slug === null) return;
    trigger.current = document.activeElement;
    heading.current?.focus();
    return () => {
      const opener = trigger.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [slug]);

  const selection = state.selected;
  const matrixCells = viewValue(state.matrix)?.cells ?? [];
  const artifacts =
    selection === null || slug === null ? null : resolveArtifactCells(matrixCells, selection, slug);

  if (slug === null || selection === null) return null;

  const close = (): void => {
    dispatch({ type: "select", selection: null });
  };
  const openStage = (next: string): void => {
    dispatch({ type: "select", selection: { kind: "stage", slug: next } });
  };

  const workflow = viewValue(state.workflow);
  const isCurrent = workflow?.currentStage === slug;
  const nextStep = viewValue(state.nextStep);
  const { prev, next } = adjacentStages(workflow?.stages ?? [], slug);

  // Single empty cell: StageArtifacts would wrap with unit chrome for one
  // empty list — keep the lean ArtifactViewer path used by matrix clicks.
  const emptyCellOnly =
    artifacts !== null &&
    artifacts.cells.length === 1 &&
    (artifacts.cells[0]?.files.length ?? 0) === 0;

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={() => {
          if (!railOpen) close();
        }}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <aside className="panel" aria-labelledby="panel-heading" data-testid="detail-panel">
          <div className="panel__bar">
            <h2 id="panel-heading" className="panel__heading" ref={heading} tabIndex={-1}>
              {formatStageLabel(slug)}
            </h2>
            <div className="panel__actions">
              <nav className="flex gap-2" aria-label="隣接ステージ">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  data-testid="panel-stage-list"
                  aria-label="ステージ一覧"
                  aria-haspopup="dialog"
                  aria-expanded={railOpen}
                  title="ステージ一覧"
                  onClick={() => {
                    setRailOpen(true);
                  }}
                >
                  <ListIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  data-testid="panel-prev-stage"
                  disabled={prev === null}
                  aria-label={
                    prev === null
                      ? "前のステージはありません"
                      : `前のステージ: ${formatStageLabel(prev)}`
                  }
                  title={
                    prev === null ? "前のステージはありません" : `前へ: ${formatStageLabel(prev)}`
                  }
                  onClick={() => {
                    if (prev !== null) openStage(prev);
                  }}
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  data-testid="panel-next-stage"
                  disabled={next === null}
                  aria-label={
                    next === null
                      ? "次のステージはありません"
                      : `次のステージ: ${formatStageLabel(next)}`
                  }
                  title={
                    next === null ? "次のステージはありません" : `次へ: ${formatStageLabel(next)}`
                  }
                  onClick={() => {
                    if (next !== null) openStage(next);
                  }}
                >
                  <ChevronRightIcon />
                </Button>
              </nav>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={close}
                data-testid="panel-close"
                aria-label="閉じる"
                title="閉じる"
              >
                <XIcon />
              </Button>
            </div>
          </div>

          <div className="panel__body">
            {doc === undefined || doc.kind === "loading" ? (
              showSkeleton ? (
                <Skeleton lines={5} label="ステージ解説" />
              ) : null
            ) : doc.kind === "error" ? (
              <AreaError detail={doc.detail} />
            ) : doc.kind === "empty" ? (
              <p className="text-sm text-muted-foreground">{doc.hint}</p>
            ) : (
              <StageCard
                doc={doc.value}
                isCurrent={isCurrent === true}
                nextStep={nextStep ?? undefined}
                onOpenStage={openStage}
              />
            )}

            {artifacts === null ? null : emptyCellOnly && artifacts.cells[0] !== undefined ? (
              <div className="mt-5 border-t pt-4">
                <Suspense fallback={<Skeleton lines={6} label="成果物" />}>
                  <ArtifactViewer
                    unit={artifacts.cells[0].unit}
                    stage={slug}
                    files={artifacts.cells[0].files}
                    verdict={artifacts.cells[0].verdict}
                    hostMode={state.hostMode}
                  />
                </Suspense>
              </div>
            ) : (
              <StageArtifacts
                key={slug}
                stage={slug}
                cells={artifacts.cells}
                initialUnit={artifacts.initialUnit}
                hostMode={state.hostMode}
              />
            )}
          </div>
          <StageRailDialog
            open={railOpen}
            onOpenChange={setRailOpen}
            workflow={state.workflow}
            purposes={stagePurposes}
            markedSlug={slug}
            onSelect={openStage}
            onRetry={retry}
          />
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
