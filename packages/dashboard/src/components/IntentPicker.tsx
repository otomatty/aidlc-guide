import type { ReactNode } from "react";
import { useAppState } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";

/**
 * M-1 header / M-4 empty state — US-15 一覧導線.
 *
 * A disclosure, deliberately **not** a select: this tool never writes the
 * `active-intent` cursor (NFR-1 / read-only), so an affordance that looks like
 * it switches intents would be a lie. It shows which intents exist, which one
 * is active, and names the command that actually switches.
 */

export const INTENT_SWITCH_HINT =
  "切り替えは Claude Code で `/aidlc intent <名前>` を実行してください（この画面からは切り替えられません）。";

export function IntentPicker(): ReactNode {
  const state = useAppState();
  const intents = viewValue(state.intents);
  // Fall back to the state file's project name while the list is loading or
  // degraded, so the header never goes blank on a healthy workspace.
  const active = intents?.active ?? viewValue(state.workflow)?.project ?? null;
  const all = intents?.all ?? [];

  return (
    <details
      className="picker"
      data-testid="intent-picker"
      // Nothing is selected but alternatives exist: open the list rather than
      // making the user discover it (the M-4 empty-state case).
      open={intents !== null && intents.active === null && all.length > 0}
    >
      <summary className="picker__summary">
        <span className="picker__label">インテント</span>{" "}
        <span className="picker__value">{active ?? "（アクティブなし）"}</span>
      </summary>
      <div className="picker__content">
        {all.length === 0 ? (
          <p className="picker__empty">インテントは見つかりませんでした。</p>
        ) : (
          <ul className="picker__list" data-testid="intent-list">
            {all.map((name) => {
              const isActive = name === intents?.active;
              return (
                <li className="picker__item" key={name} data-active={isActive}>
                  <span aria-hidden="true">{isActive ? "✔" : "○"}</span> {name}
                  {isActive ? <span className="picker__badge">（アクティブ）</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="picker__hint">{INTENT_SWITCH_HINT}</p>
      </div>
    </details>
  );
}
