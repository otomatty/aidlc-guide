import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { prefetchArtifact } from "../services/api.ts";
import { slugOf } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { artifactPath, firstArtifact } from "../viewer/artifact-path.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { StageCard } from "./StageCard.tsx";

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

export function DetailPanel(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<Element | null>(null);

  const slug = slugOf(state.selected);
  const doc = slug === null ? undefined : state.stageDoc[slug];
  const showSkeleton = useDelayedLoading(doc?.kind === "loading");

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
  const cell =
    selection?.kind === "cell"
      ? viewValue(state.matrix)?.cells.find(
          (each) => each.unit === selection.unit && each.stage === selection.stage,
        )
      : undefined;

  const openFirst = cell === undefined ? null : firstArtifact(cell.files);
  const target =
    selection?.kind === "cell" && openFirst !== null
      ? artifactPath(selection.unit, selection.stage, openFirst)
      : null;
  const warmed = useRef<string | null>(null);
  if (warmed.current !== target) {
    warmed.current = target;
    if (target !== null) prefetchArtifact(target);
  }

  if (slug === null) return null;

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

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={close}
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

            {selection?.kind === "cell" && cell !== undefined ? (
              <Suspense fallback={<Skeleton lines={6} label="成果物" />}>
                <ArtifactViewer
                  unit={selection.unit}
                  stage={selection.stage}
                  files={cell.files}
                  verdict={cell.verdict}
                  hostMode={state.hostMode}
                />
              </Suspense>
            ) : null}
          </div>
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
