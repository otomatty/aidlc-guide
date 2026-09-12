import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The scrolling content region of a panel.
 *
 * The body sizes to its content; App owns scrolling for both current progress
 * and page content, below the fixed header.
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
  headingFont?: "body" | "mono";
  /** Bar content rendered before the heading (back button, menu, …). */
  leading?: ReactNode;
  /** Extra action buttons rendered before the close button. */
  actions?: ReactNode;
  /** Omit when the page uses navigation instead of a close button. */
  closeTestId?: string;
  onClose: () => void;
  /** Escape handling when plain close is not enough (nested dialog first). */
  onEscapeKeyDown?: ComponentProps<typeof DismissableLayer>["onEscapeKeyDown"];
  /**
   * Re-runs the focus save/heading-focus cycle when it changes (DetailPanel
   * re-focuses per stage). Mount/unmount alone covers open/close panels.
   */
  focusKey?: unknown;
  /** Persistent navigation control to focus when its menu item has unmounted. */
  returnFocusSelector?: string;
  children: ReactNode;
}

/**
 * The chrome every side panel shares: focus scope, dismissable layer, the
 * panel `aside` with its bar/heading/close button, and the focus save-and-
 * restore cycle. Panels own only their bar extras and body — this existed as
 * three near-identical copies (Detail/Agent/Guides) before being extracted.
 *
 * The page stays in normal flow after the shared progress region.
 */
export function PanelShell({
  headingId,
  testId,
  title,
  headingFont = "mono",
  leading,
  actions,
  closeTestId,
  onClose,
  onEscapeKeyDown,
  focusKey,
  returnFocusSelector,
  children,
}: PanelShellProps): ReactNode {
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<Element | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focusKey is a re-run trigger, not read in the body
  useEffect(() => {
    const panelElement = panel.current;
    trigger.current = document.activeElement;
    heading.current?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      // Preserve an explicit move to navigation or another mounted page.
      // Body focus after unmount still needs the usual opener restoration.
      if (
        active !== null &&
        active !== document.body &&
        active.isConnected &&
        !panelElement?.contains(active)
      ) {
        return;
      }
      const opener =
        (returnFocusSelector === undefined ? null : document.querySelector(returnFocusSelector)) ??
        trigger.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [focusKey, returnFocusSelector]);

  return (
    <FocusScope asChild trapped={false} onUnmountAutoFocus={preventDefault}>
      <DismissableLayer
        asChild
        onEscapeKeyDown={(event) => {
          const target = event.target;
          // Base UI menus handle Escape separately from this Radix layer.
          // Let the menu close before the page responds to another Escape.
          if (
            target instanceof Element &&
            target.closest('[role="menu"], [aria-haspopup="menu"][aria-expanded="true"]') !== null
          ) {
            return;
          }
          if (onEscapeKeyDown) onEscapeKeyDown(event);
          else onClose();
        }}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <aside
          ref={panel}
          className="flex w-full flex-col bg-background p-4 text-foreground"
          aria-labelledby={headingId}
          data-testid={testId}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {leading}
            <h2
              id={headingId}
              // `font-[family-name:var(--font-mono)]`, not `font-mono`: the
              // theme entry is `@theme inline`, so the utility bakes the
              // default stack in and would stop following the VS Code editor
              // font that `html[data-host="vscode"]` maps onto `--font-mono`.
              className={cn(
                "m-0 flex min-w-0 flex-1 basis-48 flex-wrap items-center gap-2 text-xl font-medium [overflow-wrap:anywhere]",
                headingFont === "mono"
                  ? "font-[family-name:var(--font-mono)]"
                  : "font-[family-name:var(--font-sans)]",
              )}
              ref={heading}
              tabIndex={-1}
            >
              {title}
            </h2>
            <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
              {actions}
              {closeTestId === undefined ? null : (
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
              )}
            </div>
          </div>
          {children}
        </aside>
      </DismissableLayer>
    </FocusScope>
  );
}
