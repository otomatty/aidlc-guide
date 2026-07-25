import type { ReactNode } from "react";
import { CHIP_STATUSES, StatusChip } from "./StatusChip.tsx";

/** The legend is generated from the same map the chips use, so it cannot drift. */
export function StatusLegend(): ReactNode {
  // The visible "凡例" text is the accessible name; no ARIA needed.
  return (
    <div className="legend">
      <span className="legend__title">凡例</span>
      <ul className="legend__list">
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
    </div>
  );
}
