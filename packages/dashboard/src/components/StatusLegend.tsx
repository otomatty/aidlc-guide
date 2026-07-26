import { type ReactNode, useState } from "react";
import { Dialog } from "./Dialog.tsx";
import { CHIP_STATUSES, StatusChip } from "./StatusChip.tsx";

/** Legend content opens in a dialog so the matrix stays readable on narrow screens. */
export function StatusLegend(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <div className="legend">
      <button
        type="button"
        className="button"
        data-testid="legend-open"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        凡例
      </button>
      <Dialog
        open={open}
        title="凡例"
        onClose={() => {
          setOpen(false);
        }}
        testId="legend-dialog"
        closeTestId="legend-dialog-close"
      >
        <ul className="legend__list" data-testid="legend-list">
          {CHIP_STATUSES.map((status) => (
            <li key={status}>
              <StatusChip status={status} />
            </li>
          ))}
          <li>
            <span className="legend__extra">
              <span aria-hidden="true">·</span> 空（成果物 0 件）
            </span>
          </li>
          <li>
            <span className="legend__extra">
              <span aria-hidden="true">—</span> 対象外（このユニットに無いステージ）
            </span>
          </li>
        </ul>
      </Dialog>
    </div>
  );
}
