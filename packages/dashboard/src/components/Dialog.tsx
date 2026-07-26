import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { type ReactNode, useId } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
  testId,
  closeTestId,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  closeTestId?: string;
}): ReactNode {
  const titleId = useId();
  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <FocusScope asChild trapped>
        <DismissableLayer asChild onDismiss={onClose}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid={testId}
          >
            <div className="dialog__bar">
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
              <button type="button" className="button" data-testid={closeTestId} onClick={onClose}>
                閉じる
              </button>
            </div>
            {children}
          </div>
        </DismissableLayer>
      </FocusScope>
    </div>
  );
}
