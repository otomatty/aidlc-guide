import type { ReactNode } from "react";

/**
 * mob-mode M2 / US-11. `--host` disables writing for **everyone**, driver
 * included, so the badge says what the viewer is looking at rather than who
 * they are. `role="status"` — announced without stealing focus.
 *
 * This is the visible half of a two-part guarantee; the server's unconditional
 * 403 is the real gate (S-MM-3). The badge exists so nobody has to discover
 * read-only by failing to save.
 */
export function ReadOnlyBadge(): ReactNode {
  return (
    <span className="badge badge--readonly" role="status" data-testid="read-only-badge">
      READ-ONLY · 参加者ビュー
    </span>
  );
}
