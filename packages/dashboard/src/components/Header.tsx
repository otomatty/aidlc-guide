import type { RemainingEstimate } from "@aidlc-guide/shared-types";
import { formatDuration } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { isExternal, safeHref, useProjectLinks } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { GuidesButton } from "./GuidesButton.tsx";
import { IntentPicker } from "./IntentPicker.tsx";
import { LiveStatus } from "./LiveStatus.tsx";
import { OfficialDocsButton } from "./OfficialDocsButton.tsx";
import { ReadOnlyBadge } from "./ReadOnlyBadge.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

export interface HeaderProps {
  /**
   * The whole-workflow roll-up, already gated on freshness by
   * `store/select-timing.ts` — `null` until `/api/timings` lands, or while
   * the payload still describes the stage that was current a moment ago (its
   * total would still bill that stage's remainder). The header renders the
   * total only when this is a live number; it makes no staleness judgement of
   * its own (issue #10).
   */
  remaining?: RemainingEstimate | null;
}

/** Shared app chrome — stays mounted on home, stage detail, and guides routes. */
export function Header({ remaining }: HeaderProps = {}): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  useProjectLinks();
  const links = viewValue(state.projectLinks) ?? [];
  const onHome =
    state.selected !== null || state.guidesOpen || state.docsShellOpen || state.agentOpen !== null;

  return (
    <header className="z-50 flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2">
      <button
        type="button"
        className="cursor-pointer rounded-lg text-lg font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
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
      <OfficialDocsButton />
      {state.hostMode ? <ReadOnlyBadge /> : null}
      <div className="ml-auto flex flex-wrap items-center gap-3">
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
        {remaining?.totalRemainingMs == null ? null : (
          /* Ambient readout, not a heading: same muted register as `LiveStatus`
             beside it, so the header's one emphatic element stays the title.
             `nowrap` keeps the figure whole — the header wraps as a flex line
             instead of breaking mid-label. */
          <span
            className="whitespace-nowrap text-muted-foreground text-sm tabular-nums"
            data-testid="header-total-remaining"
          >
            残り実作業 ≈{formatDuration(remaining.totalRemainingMs)}
            {remaining.lowConfidence ? "（参考値）" : ""}
          </span>
        )}
      </div>
    </header>
  );
}
