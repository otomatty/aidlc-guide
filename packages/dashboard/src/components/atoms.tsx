import type { ReactNode } from "react";
import { INTENT_SWITCH_HINT } from "./IntentPicker.tsx";
import { STATUS_PRESENTATION } from "./StatusChip.tsx";

/**
 * The small cross-cutting pieces: Skeleton / UnparseableBadge / EmptyState /
 * AreaError. `LiveStatus` and `ReadOnlyBadge` started here and now live in
 * their own files (mob-mode logical-components.md) — they carry unit-level
 * guarantees rather than being shared atoms.
 */

export function Skeleton({ lines = 3, label }: { lines?: number; label: string }): ReactNode {
  return (
    <div className="skeleton" role="status" aria-busy="true" aria-label={`${label}を読み込み中`}>
      {Array.from({ length: lines }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: purely decorative bars
        <span className="skeleton__bar" key={index} />
      ))}
    </div>
  );
}

/**
 * R-UI-2: degradation always shows up as an element. `role="status"` so a
 * screen reader is told without stealing focus (a11y checklist 4.1.2).
 */
export function UnparseableBadge({ detail }: { detail: string }): ReactNode {
  const { symbol, label } = STATUS_PRESENTATION.unparseable;
  return (
    <span className="badge badge--danger" role="status">
      <span className="badge__symbol" aria-hidden="true">
        {symbol}
      </span>
      <span className="badge__label">解析不可（{label}）</span>
      <span className="badge__detail">{detail}</span>
    </span>
  );
}

/**
 * M-4. `role="alert"` because an empty workspace is the whole answer to the
 * question the user just asked, not a background event.
 *
 * `children` is the intent list (US-15 一覧導線). The copy names the command
 * instead of offering a control, because selecting an intent means writing the
 * `active-intent` cursor and this tool never writes it (NFR-1).
 */
export function EmptyState({ hint, children }: { hint: string; children?: ReactNode }): ReactNode {
  return (
    <div className="empty" role="alert">
      <h2 className="empty__title">インテントがありません</h2>
      {/* The reason line — "アクティブなインテントがありません" for the
          no-active-intent case (deriveViewState), not a second title. */}
      <p className="empty__hint">{hint}</p>
      <p className="empty__help">
        `/aidlc` で最初のインテントを作成してください。既存のインテントは下の一覧で確認できます。
        {INTENT_SWITCH_HINT}
      </p>
      {children}
    </div>
  );
}

export function AreaError({
  detail,
  onRetry,
}: {
  detail: string;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div className="area-error">
      <UnparseableBadge detail={detail} />
      {onRetry === undefined ? null : (
        <button type="button" className="button" onClick={onRetry} data-testid="retry">
          再試行
        </button>
      )}
    </div>
  );
}
