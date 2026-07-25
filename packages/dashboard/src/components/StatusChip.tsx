import type { StageStatus } from "@aidlc-guide/shared-types";
import type { CSSProperties, ReactNode } from "react";

/**
 * BR-UI-2 / US-18: every status is colour **and** symbol **and** text label,
 * all three present in the DOM. This map is 1:1 with the seven rows of
 * design-system-mapping.md — the single place a status becomes pixels, so
 * there is no second rendering to forget the symbol.
 */

export type ChipStatus = StageStatus | "unparseable";

export interface StatusPresentation {
  /** CSS custom property name, resolved by styles/tokens.css. */
  token: string;
  symbol: string;
  label: string;
}

export const STATUS_PRESENTATION: Readonly<Record<ChipStatus, StatusPresentation>> = {
  completed: { token: "--color-status-done", symbol: "✔", label: "completed" },
  "in-progress": { token: "--color-status-progress", symbol: "◐", label: "in progress" },
  "awaiting-approval": { token: "--color-status-gate", symbol: "◔", label: "awaiting approval" },
  revising: { token: "--color-status-revising", symbol: "◑", label: "revising" },
  "not-started": { token: "--color-status-idle", symbol: "○", label: "not started" },
  skipped: { token: "--color-status-skip", symbol: "⊘", label: "skipped" },
  unparseable: { token: "--color-danger", symbol: "⚠", label: "unparseable" },
};

export const CHIP_STATUSES = Object.keys(STATUS_PRESENTATION) as ChipStatus[];

export function StatusChip({ status }: { status: ChipStatus }): ReactNode {
  const { token, symbol, label } = STATUS_PRESENTATION[status];
  // The token name stays in the DOM (as a custom property) so the triple
  // representation is verifiable by test, not only by eye.
  const style = { "--chip-color": `var(${token})` } as CSSProperties;
  return (
    <span className="chip" data-status={status} data-token={token} style={style}>
      <span className="chip__symbol" aria-hidden="true">
        {symbol}
      </span>
      <span className="chip__label">{label}</span>
    </span>
  );
}
