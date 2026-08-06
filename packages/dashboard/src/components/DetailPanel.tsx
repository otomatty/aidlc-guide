import type { MatrixCell } from "@aidlc-guide/shared-types";
import { ChevronLeftIcon, ChevronRightIcon, ListIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { useFetchView } from "../hooks/useFetchView.ts";
import { fetchIoPaths, refetchAll } from "../services/api.ts";
import { slugOf, useStagePurposes } from "../services/docs.ts";
import { inVsCodeWebview } from "../services/vscode-api.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import type { Selection } from "../store/state.ts";
import { viewValue } from "../store/state.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { IoArtifactPreview } from "./IoArtifactPreview.tsx";
import { PanelBody, PanelShell } from "./PanelShell.tsx";
import { cellsWithArtifacts, StageArtifacts } from "./StageArtifacts.tsx";
import { StageCard } from "./StageCard.tsx";
import { StageRailDialog } from "./StageRailDialog.tsx";
import { StatusChip } from "./StatusChip.tsx";

const ArtifactViewer = lazy(async () => await import("../viewer/index.tsx"));

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
function resolveArtifactCells(
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
  const [railOpen, setRailOpen] = useState(false);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  const [ioPreviewPath, setIoPreviewPath] = useState<string | null>(null);

  const slug = slugOf(state.selected);
  const doc = slug === null ? undefined : state.stageDoc[slug];
  const showSkeleton = useDelayedLoading(doc?.kind === "loading");
  const stagePurposes = useStagePurposes();

  const retry = useCallback(() => {
    dispatch({ type: "reloading" });
    void refetchAll(dispatch);
  }, [dispatch]);

  const selection = state.selected;
  const matrixCells = viewValue(state.matrix)?.cells ?? [];
  const artifacts =
    selection === null || slug === null ? null : resolveArtifactCells(matrixCells, selection, slug);
  const initialArtifactUnit = artifacts?.initialUnit ?? null;
  const effectiveUnit =
    activeUnit !== null && artifacts?.cells.some((cell) => cell.unit === activeUnit) === true
      ? activeUnit
      : initialArtifactUnit;

  // Seed on stage change only — not when matrix refresh reshuffles
  // initialArtifactUnit (that would wipe a manual Unit tab choice). Cell
  // selections set the unit explicitly in the second effect.
  const seededSlug = useRef<string | null>(null);
  useEffect(() => {
    if (slug === null) {
      seededSlug.current = null;
      setActiveUnit(null);
      setIoPreviewPath(null);
      return;
    }
    if (seededSlug.current !== slug) {
      seededSlug.current = slug;
      setActiveUnit(initialArtifactUnit);
      setIoPreviewPath(null);
    }
  }, [slug, initialArtifactUnit]);

  useEffect(() => {
    if (selection?.kind === "cell") setActiveUnit(selection.unit);
  }, [selection]);

  // Re-fetch when this stage's on-disk file set changes (matrix push) even if
  // slug/unit stay the same — otherwise new/deleted outputs stay mislinked.
  const ioMatrixToken =
    slug === null
      ? ""
      : matrixCells
          .filter((cell) => cell.stage === slug)
          .map((cell) => `${cell.unit}:${cell.files.join(",")}`)
          .sort()
          .join("|");

  const ioLoad =
    inVsCodeWebview() && slug !== null ? () => fetchIoPaths(slug, effectiveUnit) : null;
  const ioView = useFetchView(ioLoad, [slug, effectiveUnit, ioMatrixToken]);
  const loadedIoPaths =
    ioView?.kind === "success" || ioView?.kind === "partial" ? ioView.value : null;
  const ioPaths =
    loadedIoPaths?.stage === slug && loadedIoPaths.unit === effectiveUnit ? loadedIoPaths : null;

  if (slug === null || selection === null) return null;

  const close = (): void => {
    dispatch({ type: "select", selection: null });
  };
  const openStage = (next: string): void => {
    dispatch({ type: "select", selection: { kind: "stage", slug: next } });
  };

  const workflow = viewValue(state.workflow);
  const isCurrent = workflow?.currentStage === slug;
  const stageInfo = workflow?.stages.find((each) => each.slug === slug);
  const nextStep = viewValue(state.nextStep);
  const { prev, next } = adjacentStages(workflow?.stages ?? [], slug);

  // Single empty cell: StageArtifacts would wrap with unit chrome for one
  // empty list — keep the lean ArtifactViewer path used by matrix clicks.
  const emptyCellOnly =
    artifacts !== null &&
    artifacts.cells.length === 1 &&
    (artifacts.cells[0]?.files.length ?? 0) === 0;

  return (
    <PanelShell
      headingId="panel-heading"
      testId="detail-panel"
      title={
        <>
          {stageInfo === undefined ? null : (
            <StatusChip
              status={stageInfo.unparseable === undefined ? stageInfo.status : "unparseable"}
            />
          )}
          {formatStageLabel(slug)}
        </>
      }
      closeTestId="panel-close"
      onClose={close}
      onEscapeKeyDown={() => {
        if (!railOpen) close();
      }}
      focusKey={slug}
      actions={
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
              prev === null ? "前のステージはありません" : `前のステージ: ${formatStageLabel(prev)}`
            }
            title={prev === null ? "前のステージはありません" : `前へ: ${formatStageLabel(prev)}`}
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
              next === null ? "次のステージはありません" : `次のステージ: ${formatStageLabel(next)}`
            }
            title={next === null ? "次のステージはありません" : `次へ: ${formatStageLabel(next)}`}
            onClick={() => {
              if (next !== null) openStage(next);
            }}
          >
            <ChevronRightIcon />
          </Button>
        </nav>
      }
    >
      <PanelBody>
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
            ioPaths={ioPaths}
            onPreviewIo={setIoPreviewPath}
          />
        )}

        {ioPreviewPath === null ? null : (
          <IoArtifactPreview path={ioPreviewPath} onClose={() => setIoPreviewPath(null)} />
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
            unit={effectiveUnit ?? artifacts.initialUnit}
            onUnitChange={setActiveUnit}
            hostMode={state.hostMode}
          />
        )}
      </PanelBody>
      <StageRailDialog
        open={railOpen}
        onOpenChange={setRailOpen}
        workflow={state.workflow}
        purposes={stagePurposes}
        markedSlug={slug}
        onSelect={openStage}
        onRetry={retry}
      />
    </PanelShell>
  );
}
