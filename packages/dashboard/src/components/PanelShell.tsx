import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The scrolling content region of a panel.
 *
 * `flex-none` on purpose: the body sizes to its content so the `aside` above
 * (which owns `overflow-y-auto`) is what scrolls. `flex-1` + `min-height: 0`
 * pinned the body to the viewport instead, and Card's `overflow-hidden` then
 * clipped expanded blocks like "docs の該当箇所".
 */
export function PanelBody({ className, ...props }: ComponentProps<"div">): ReactNode {
  return <div className={cn("flex flex-none flex-col gap-4", className)} {...props} />;
}

const preventDefault = (event: Event): void => {
  event.preventDefault();
};

export interface PanelShellProps {
  /** `aria-labelledby` target id for the heading. */
  headingId: string;
  /** `data-testid` of the `aside`. */
  testId: string;
  title: ReactNode;
  /** Bar content rendered before the heading (back button, menu, …). */
  leading?: ReactNode;
  /** Extra action buttons rendered before the close button. */
  actions?: ReactNode;
  closeTestId: string;
  onClose: () => void;
  /** Escape handling when plain close is not enough (nested dialog first). */
  onEscapeKeyDown?: ComponentProps<typeof DismissableLayer>["onEscapeKeyDown"];
  /**
   * Re-runs the focus save/heading-focus cycle when it changes (DetailPanel
   * re-focuses per stage). Mount/unmount alone covers open/close panels.
   */
  focusKey?: unknown;
  children: ReactNode;
}

/**
 * The chrome every side panel shares: focus scope, dismissable layer, the
 * panel `aside` with its bar/heading/close button, and the focus save-and-
 * restore cycle. Panels own only their bar extras and body — this existed as
 * three near-identical copies (Detail/Agent/Guides) before being extracted.
 *
 * The `aside` fills the app's main area under the shared header, not the whole
 * viewport — hence `absolute inset-0` rather than `fixed`.
 */
export function PanelShell({
  headingId,
  testId,
  title,
  leading,
  actions,
  closeTestId,
  onClose,
  onEscapeKeyDown,
  focusKey,
  children,
}: PanelShellProps): ReactNode {
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<Element | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focusKey is a re-run trigger, not read in the body
  useEffect(() => {
    trigger.current = document.activeElement;
    heading.current?.focus();
    return () => {
      const opener = trigger.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [focusKey]);

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={
          onEscapeKeyDown ??
          (() => {
            onClose();
          })
        }
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <aside
          className="absolute inset-0 z-40 flex w-full flex-col overflow-y-auto overscroll-contain bg-background p-4 text-foreground shadow-panel"
          aria-labelledby={headingId}
          data-testid={testId}
        >
          <div className="mb-4 flex items-center gap-3">
            {leading}
            <h2
              id={headingId}
              // `font-[family-name:var(--font-mono)]`, not `font-mono`: the
              // theme entry is `@theme inline`, so the utility bakes the
              // default stack in and would stop following the VS Code editor
              // font that `html[data-host="vscode"]` maps onto `--font-mono`.
              className="m-0 flex flex-wrap items-center gap-2 font-[family-name:var(--font-mono)] text-xl font-medium"
              ref={heading}
              tabIndex={-1}
            >
              {title}
            </h2>
            <div className="ml-auto flex items-center gap-2">
              {actions}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onClose}
                data-testid={closeTestId}
                aria-label="閉じる"
                title="閉じる"
              >
                <XIcon />
              </Button>
            </div>
          </div>
          {children}
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
