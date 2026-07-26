import { type ReactNode, useEffect, useState } from "react";
import { useAppState } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { Dialog } from "./Dialog.tsx";

/**
 * M-1 header / M-4 empty state — US-15 一覧導線.
 *
 * A dialog list, deliberately **not** a select: this tool never writes the
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
  const shouldAutoOpen = intents !== null && intents.active === null && all.length > 0;
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) setOpen(true);
  }, [shouldAutoOpen]);

  return (
    <div className="picker" data-testid="intent-picker">
      <button
        type="button"
        className="picker__trigger"
        data-testid="intent-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        <span className="picker__label">インテント</span>{" "}
        <span className="picker__value">{active ?? "（アクティブなし）"}</span>
      </button>

      <Dialog
        open={open}
        title="インテント一覧"
        onClose={() => {
          setOpen(false);
        }}
        testId="intent-dialog"
        closeTestId="intent-dialog-close"
      >
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
      </Dialog>
    </div>
  );
}
