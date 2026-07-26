import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { lazy, type ReactNode, Suspense, useEffect, useRef } from "react";
import { formatStageLabel } from "../data/stage-numbers.ts";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { prefetchArtifact } from "../services/api.ts";
import { slugOf } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
// Leaf module, no imports of its own: importing it here does not pull the
// viewer chunk into the initial bundle (P-AV-1).
import { artifactPath, firstArtifact } from "../viewer/artifact-path.ts";
import { AreaError, Skeleton } from "./atoms.tsx";
import { StageCard } from "./StageCard.tsx";

/**
 * P-AV-1: the artifact viewer — and with it `marked` and `mermaid` — is only
 * ever reached through this dynamic import, so none of it can land in the
 * initial chunk.
 */
const ArtifactViewer = lazy(async () => await import("../viewer/index.tsx"));

/**
 * **Non-modal** complementary panel (C-2 / a11y checklist 2.1.2). The dashboard
 * behind it stays operable, so there is no focus trap, no backdrop and no
 * `aria-modal`: `FocusScope trapped={false}` moves focus in on open and
 * restores it on close, `DismissableLayer` handles Esc and outside clicks.
 * A modal Dialog would imprison keyboard users in a panel they are meant to be
 * able to walk out of.
 */
const preventDefault = (event: Event): void => {
  event.preventDefault();
};

export function DetailPanel(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  const heading = useRef<HTMLHeadingElement>(null);

  const trigger = useRef<Element | null>(null);

  const slug = slugOf(state.selected);
  const doc = slug === null ? undefined : state.stageDoc[slug];
  const showSkeleton = useDelayedLoading(doc?.kind === "loading");

  /**
   * Focus in on open, back to the opener on close. Owned here rather than left
   * to FocusScope's own autofocus: FocusScope captures `document.activeElement`
   * in a second commit (once its container ref resolves), by which time the
   * heading is already focused — it would then "restore" focus to a heading
   * that is being unmounted, i.e. to nowhere. `onUnmountAutoFocus` below opts
   * out of that. FocusScope is still what keeps the scope untrapped.
   */
  useEffect(() => {
    if (slug === null) return;
    trigger.current = document.activeElement;
    heading.current?.focus();
    return () => {
      const opener = trigger.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [slug]);

  // A cell selection also opens the artifacts of that cell. The filenames come
  // from the matrix slice the server already sent — there is no per-cell
  // listing endpoint (MatrixCell.files).
  const selection = state.selected;
  const cell =
    selection?.kind === "cell"
      ? viewValue(state.matrix)?.cells.find(
          (each) => each.unit === selection.unit && each.stage === selection.stage,
        )
      : undefined;

  /**
   * P-AV-2「開く操作の時点で両方開始」. Fired in the **render phase**, which is
   * the same tick in which rendering `<ArtifactViewer>` triggers its chunk
   * import — the two are then genuinely in flight together. An effect would be
   * too late: effects run child-first, so once the chunk is warm the viewer's
   * own read would already have gone out and the prefetch would duplicate it.
   *
   * `warmed` makes it fire once per target, so an unrelated re-render of the
   * panel cannot issue a second read. `firstArtifact` is the shared rule, so
   * the warmed path is always the one the viewer opens. D1's flow still lives
   * in the viewer — it just finds the request already running.
   */
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

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={close}
        onPointerDownOutside={close}
        onFocusOutside={(event) => {
          // Non-modal: focus leaving the panel is allowed, not a dismissal.
          event.preventDefault();
        }}
      >
        <aside className="panel" aria-labelledby="panel-heading" data-testid="detail-panel">
          <div className="panel__bar">
            <h2 id="panel-heading" className="panel__heading" ref={heading} tabIndex={-1}>
              {slug === null ? "" : formatStageLabel(slug)}
            </h2>
            <button type="button" className="button" onClick={close} data-testid="panel-close">
              ✕ 閉じる
            </button>
          </div>

          {doc === undefined || doc.kind === "loading" ? (
            showSkeleton ? (
              <Skeleton lines={5} label="ステージ解説" />
            ) : null
          ) : doc.kind === "error" ? (
            <AreaError detail={doc.detail} />
          ) : doc.kind === "empty" ? (
            <p>{doc.hint}</p>
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
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
