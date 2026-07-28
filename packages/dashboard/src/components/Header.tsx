import type { TimingsPayload, WorkflowModel } from "@aidlc-guide/shared-types";
import { formatDuration } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { currentStageMatches } from "../lib/stage-match.ts";
import { isExternal, safeHref, useProjectLinks } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { GuidesButton } from "./GuidesButton.tsx";
import { IntentPicker } from "./IntentPicker.tsx";
import { LiveStatus } from "./LiveStatus.tsx";
import { ReadOnlyBadge } from "./ReadOnlyBadge.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

export interface HeaderProps {
  /** `null` until `/api/timings` lands — the total renders only once known. */
  timings?: TimingsPayload | null;
  /**
   * `null` until `/api/workflow` lands. Threaded from App.tsx the same way
   * `timings` is (not read off the store) so the two props the total depends
   * on stay symmetric. Gates the total on stage match — see
   * `currentStageMatches` (Codex PR #4 finding 2).
   */
  workflow?: WorkflowModel | null;
}

/** Shared app chrome — stays mounted on home, stage detail, and guides routes. */
export function Header({ timings, workflow }: HeaderProps = {}): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  useProjectLinks();
  const links = viewValue(state.projectLinks) ?? [];
  const onHome = state.selected !== null || state.guidesOpen || state.agentOpen !== null;

  return (
    <header className="header">
      <button
        type="button"
        className="header__title"
        data-testid="header-home"
        aria-current={onHome ? undefined : "page"}
        onClick={() => {
          dispatch({ type: "home" });
        }}
      >
        AIDLC Guide
      </button>
      <IntentPicker />
      <GuidesButton />
      {state.hostMode ? <ReadOnlyBadge /> : null}
      <div className="header__trailing">
        <nav className="flex gap-3" aria-label="プロジェクトリンク">
          {links.map((link) => {
            const href = safeHref(link.target);
            if (href === null) return null;
            return (
              <a
                key={link.label}
                href={href}
                className="text-primary underline-offset-4 hover:underline"
                rel="noopener noreferrer"
                {...(isExternal(href) ? { target: "_blank" } : {})}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
        <LiveStatus live={state.live} />
        <ThemeToggle />
        {timings?.remaining.totalRemainingMs == null ||
        !currentStageMatches(
          workflow?.currentStage ?? null,
          timings.remaining.currentStage,
        ) ? null : (
          <span className="header__remaining" data-testid="header-total-remaining">
            残り実作業 ≈{formatDuration(timings.remaining.totalRemainingMs)}
            {timings.remaining.lowConfidence ? "（参考値）" : ""}
          </span>
        )}
      </div>
    </header>
  );
}
