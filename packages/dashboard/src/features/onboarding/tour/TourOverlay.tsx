import { Popover } from "@base-ui/react/popover";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppState, useDispatch } from "@/store/context.tsx";
import { viewValue } from "@/store/state.ts";
import { buildTourSteps, type TourRoute } from "./steps.ts";
import { type AnchorBox, useTourAnchor } from "./useTourAnchor.ts";

const RING_GAP = 6;
const RING_RADIUS = 10;

/** Where the card goes when its element could not be found: the upper middle. */
const CENTER = {
  getBoundingClientRect() {
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 3;
    return { x, y, top: y, left: x, right: x, bottom: y, width: 0, height: 0 };
  },
};

/** A rounded rectangle as an SVG subpath. */
function roundedRect(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RING_RADIUS, width / 2, height / 2);
  return [
    `M${x + r},${y}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${y + r}`,
    `V${y + height - r}`,
    `A${r},${r} 0 0 1 ${x + width - r},${y + height}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + height - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    "Z",
  ].join(" ");
}

/**
 * Fades everything but the step's element in the page's own background
 * colour, and rings the element. One even-odd path cuts the hole, so no mask
 * or literal colour is needed; the SVG clips the oversized outer square to
 * the viewport. It never takes pointer events.
 */
function Spotlight({ box }: { box: AnchorBox | null }): ReactNode {
  const hole =
    box === null
      ? null
      : roundedRect(
          box.left - RING_GAP,
          box.top - RING_GAP,
          box.width + RING_GAP * 2,
          box.height + RING_GAP * 2,
        );
  return (
    <svg
      aria-hidden="true"
      data-testid="tour-spotlight"
      className="pointer-events-none fixed inset-0 z-60 size-full"
    >
      <path
        d={`M-1,-1 H100000 V100000 H-1 Z ${hole ?? ""}`}
        fillRule="evenodd"
        className="fill-background/75"
      />
      {hole === null ? null : (
        <path d={hole} fillOpacity={0} strokeWidth={2} className="stroke-ring" />
      )}
    </svg>
  );
}

/**
 * The guided tour: one card at a time, pointing at the real element on the
 * user's own workflow. It opens the pages it explains, keeps focus inside the
 * card, and ends with Escape or 「ツアーを終了」 at any step.
 */
export default function TourOverlay(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  // Fixed at the start: a live workflow push must not reshuffle the steps.
  const [steps] = useState(() => buildTourSteps(viewValue(state.workflow)));
  const [index, setIndex] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const step = steps[index] ?? steps[0];
  const { element, box, status } = useTourAnchor(
    step?.anchor ?? { attr: "data-testid", value: "header-menu-trigger" },
  );

  const end = useCallback((): void => {
    dispatch({ type: "tour", active: false });
    dispatch({ type: "home" });
    requestAnimationFrame(() => document.getElementById("header-menu-trigger")?.focus());
  }, [dispatch]);

  // Each step opens the page it explains; the page underneath is inert, so
  // the tour is the only thing that moves between pages while it runs.
  const open = useCallback(
    (to: TourRoute): void => {
      if (to === null) return;
      if (to.name === "home") dispatch({ type: "home" });
      else dispatch({ type: "select", selection: { kind: "stage", slug: to.slug } });
    },
    [dispatch],
  );
  useEffect(() => {
    open(steps[0]?.route ?? null);
  }, [open, steps]);
  const goTo = (next: number): void => {
    open(steps[next]?.route ?? null);
    setIndex(next);
  };

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [index]);

  if (step === undefined) return null;
  const last = index === steps.length - 1;

  return (
    <Popover.Root
      open
      modal
      onOpenChange={(next, details) => {
        // Only Escape or 「ツアーを終了」 end the tour. A page that takes focus
        // while it opens, or a click on the faded page, must not.
        if (!next && (details.reason === "escape-key" || details.reason === "close-press")) end();
      }}
    >
      <Popover.Portal>
        <Spotlight box={status === "found" ? box : null} />
        <Popover.Positioner
          anchor={element ?? CENTER}
          side="bottom"
          align={element === null ? "center" : "start"}
          sideOffset={12}
          collisionPadding={16}
          className="z-60"
        >
          <Popover.Popup
            initialFocus={title}
            data-testid="tour-card"
            data-anchor={status}
            className="flex w-80 max-w-viewport-gutter flex-col gap-2 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none"
          >
            <p className="text-xs text-muted-foreground" aria-hidden="true">
              {`${index + 1} / ${steps.length}`}
            </p>
            <Popover.Title ref={title} tabIndex={-1} className="text-base font-medium outline-none">
              {step.title}
            </Popover.Title>
            <Popover.Description className="leading-relaxed text-muted-foreground">
              {step.body}
            </Popover.Description>
            {status === "missing" ? (
              <p className="text-xs text-muted-foreground">
                この画面では対象の場所を表示できませんでした。説明だけ確認して進めます。
              </p>
            ) : null}
            <p className="sr-only">{`手順 ${index + 1} / ${steps.length}`}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Popover.Close render={<Button type="button" variant="ghost" size="sm" />}>
                ツアーを終了
              </Popover.Close>
              <div className="flex gap-2">
                {index === 0 ? null : (
                  <Button type="button" variant="outline" size="sm" onClick={() => goTo(index - 1)}>
                    戻る
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => (last ? end() : goTo(index + 1))}>
                  {last ? "完了" : "次へ"}
                </Button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
