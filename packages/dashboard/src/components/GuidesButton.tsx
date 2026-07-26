import { type ReactNode, useState } from "react";
import { GuidesPanel } from "./GuidesPanel.tsx";

/** Header entry that opens the in-app usage guides panel. */
export function GuidesButton(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button"
        data-testid="guides-open"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        使い方
      </button>
      <GuidesPanel
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
