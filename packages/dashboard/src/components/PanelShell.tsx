import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

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
 * `panel` aside with its bar/heading/close button, and the focus save-and-
 * restore cycle. Panels own only their bar extras and body — this existed as
 * three near-identical copies (Detail/Agent/Guides) before being extracted.
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
        <aside className="panel" aria-labelledby={headingId} data-testid={testId}>
          <div className="panel__bar">
            {leading}
            <h2 id={headingId} className="panel__heading" ref={heading} tabIndex={-1}>
              {title}
            </h2>
            <div className="panel__actions">
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
